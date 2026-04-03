import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { rejectMilestone, isBlockchainConfigured } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

const RejectSchema = z.object({
  milestoneId: z.number().int().positive(),
  reason: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only the client can reject milestones
    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = RejectSchema.safeParse(body);

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
        { error: "Milestone must be in 'delivered' status to reject" },
        { status: 400 },
      );
    }

    const updatedContract = await db.contracts.updateMilestone(
      id,
      parsed.data.milestoneId,
      { status: "rejected" },
    );

    // Attempt on-chain rejection if blockchain is configured
    if (isBlockchainConfigured() && contract.onChainAddress) {
      await db.blockchainEvents.tracked(
        { contractId: id, operation: "reject", chain: "arbitrum", params: { milestoneId: parsed.data.milestoneId } },
        async () => {
          const txHash = await rejectMilestone(
            contract.onChainAddress!,
            parsed.data.milestoneId,
            parsed.data.reason || "Rejected",
          );
          return { txHash };
        },
      );
    }

    // Notify agency that milestone was rejected
    if (contract.agency) {
      notifyUser(contract.agency, {
        type: "milestone_rejected",
        contractTitle: contract.title,
        contractId: id,
        milestoneName: milestone?.name,
        reason: parsed.data.reason,
      });
    }

    return Response.json({
      contract: updatedContract,
      reason: parsed.data.reason,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
