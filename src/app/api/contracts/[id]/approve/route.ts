import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { calculateMilestoneRelease } from "@/lib/payments/escrow";
import { approveMilestone, postAttestation, isBlockchainConfigured, CHAIN_CONFIG } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

const ApproveSchema = z.object({
  milestoneId: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only the client can approve milestones
    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = ApproveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(id);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    const milestone = contract.milestones.find(
      (m) => m.id === parsed.data.milestoneId,
    );
    if (!milestone) {
      return Response.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "delivered") {
      return Response.json(
        { error: "Milestone must be in 'delivered' status to approve" },
        { status: 400 },
      );
    }

    // Block approval if milestone has an active (unresolved) dispute
    const activeDisputes = (await db.disputes
      .findByContract(id))
      .filter(
        (d) =>
          d.milestoneId === parsed.data.milestoneId &&
          d.phase !== "resolved",
      );
    if (activeDisputes.length > 0) {
      return Response.json(
        {
          error:
            "Cannot approve milestone with an active dispute. The dispute must be resolved first.",
        },
        { status: 400 },
      );
    }

    const feeBreakdown = calculateMilestoneRelease(
      milestone.amount,
      contract.bdFeePercent,
    );

    const updatedContract = await db.contracts.updateMilestone(
      id,
      parsed.data.milestoneId,
      {
        status: "approved",
        approvedAt: new Date(),
      },
    );

    const escrow = await db.escrows.release(id, milestone.amount);

    const allApproved = updatedContract.milestones.every(
      (m) => m.status === "approved",
    );
    if (allApproved) {
      await db.contracts.update(id, { status: "completed" });
    }

    // Attempt real on-chain milestone approval if blockchain is configured
    if (isBlockchainConfigured() && contract.onChainAddress) {
      await db.blockchainEvents.tracked(
        { contractId: id, operation: "approve", chain: "arbitrum", params: { milestoneId: parsed.data.milestoneId } },
        async () => {
          const txHash = await approveMilestone(contract.onChainAddress!, parsed.data.milestoneId);
          return { txHash };
        },
      );

      // Record completion on AgencyProfile
      if (allApproved && CHAIN_CONFIG.agencyProfileAddress) {
        await db.blockchainEvents.tracked(
          { contractId: id, operation: "record_completion", chain: "arbitrum", params: { agency: contract.agency } },
          async () => {
            const { recordCompletion } = await import("@/lib/blockchain/agency-profile");
            const txHash = await recordCompletion(
              contract.agency,
              BigInt(Math.round(contract.totalValue * 1e18)),
              100, // completion score (no AI scoring)
            );
            return { txHash };
          },
        );
      }

      if (allApproved && contract.tokenAddress && CHAIN_CONFIG.attestationAddress) {
        await db.blockchainEvents.tracked(
          { contractId: id, operation: "attest", chain: "arbitrum", params: { tokenAddress: contract.tokenAddress } },
          async () => {
            const txHash = await postAttestation({
              attestationAddress: CHAIN_CONFIG.attestationAddress,
              tokenAddress: contract.tokenAddress!,
              approved: true,
              reason: "All milestones approved — contract completed successfully",
              score: 100,
            });
            return { txHash };
          },
        );
      }
    }

    // Notify agency that milestone was approved
    if (contract.agency) {
      notifyUser(contract.agency, {
        type: "milestone_approved",
        contractTitle: contract.title,
        contractId: id,
        milestoneName: milestone.name,
      });
    }

    // Notify both parties when contract is fully completed
    if (allApproved) {
      const completedNotif = {
        type: "contract_completed" as const,
        contractTitle: contract.title,
        contractId: id,
      };
      if (contract.agency) notifyUser(contract.agency, completedNotif);
      if (contract.client) notifyUser(contract.client, completedNotif);
    }

    const blockchainWarnings = await db.blockchainEvents.getFailedEvents(id);
    return Response.json({
      contract: allApproved
        ? await db.contracts.findById(id)
        : updatedContract,
      escrow,
      feeBreakdown,
      ...(blockchainWarnings.length > 0 && { blockchainWarnings }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
