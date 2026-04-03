import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { calculateMilestoneRelease } from "@/lib/payments/escrow";
import { approveMilestone, isBlockchainConfigured } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";
import { privateTransfer, isUnlinkConfigured } from "@/lib/privacy";

// USDC on Base Sepolia
const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

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

    // Attempt private milestone payout via Unlink shielded pool (server-side ZKP)
    if (isUnlinkConfigured()) {
      try {
        // Get the client's mnemonic (escrow holder) and agency's mnemonic (recipient)
        const clientRaw = await db.users.findRawByAddress(auth.walletAddress);
        const agencyRaw = await db.users.findRawByAddress(contract.agency);
        if (clientRaw?.unlinkMnemonic && agencyRaw?.unlinkMnemonic) {
          const { createUnlinkClient } = await import("@/lib/privacy");
          const agencyUnlink = createUnlinkClient(agencyRaw.unlinkMnemonic);
          const agencyUnlinkAddress = await agencyUnlink.getAddress();
          const toAgencyAmount = feeBreakdown.toAgency;
          const payoutAmountWei = BigInt(Math.round(toAgencyAmount * 1e6)); // USDC 6 decimals
          await privateTransfer(
            clientRaw.unlinkMnemonic,
            agencyUnlinkAddress,
            PAYMENT_TOKEN,
            payoutAmountWei.toString(),
          );
        }
      } catch (unlinkError) {
        // Unlink failure must not block the DB operation — log and continue
        console.error("[Unlink] privateTransfer failed:", unlinkError);
      }
    }

    const allApproved = updatedContract.milestones.every(
      (m) => m.status === "approved",
    );
    if (allApproved) {
      await db.contracts.update(id, { status: "completed" });
    }

    // Attempt real on-chain milestone approval if blockchain is configured
    if (isBlockchainConfigured() && contract.onChainAddress) {
      try {
        const txHash = await approveMilestone(contract.onChainAddress, parsed.data.milestoneId);
        console.log("[approve] On-chain approveMilestone success:", txHash);
      } catch (err) {
        console.warn("[approve] On-chain approveMilestone failed:", err);
      }

      // AgencyProfile on-chain recording not yet available — skipped
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

    return Response.json({
      contract: allApproved
        ? await db.contracts.findById(id)
        : updatedContract,
      escrow,
      feeBreakdown,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
