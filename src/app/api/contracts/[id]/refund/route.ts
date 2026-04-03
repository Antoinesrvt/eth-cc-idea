import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { markContractFailed, refundEscrow as refundEscrowOnChain, isBlockchainConfigured } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Only client can refund
    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const contract = await db.contracts.findById(id);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    // Must be in a refundable state
    if (contract.status !== "failed" && contract.status !== "disputed") {
      // If contract is active/completed, mark it as failed first
      if (contract.status === "active" || contract.status === "pending_deposit") {
        await db.contracts.update(id, { status: "failed" });

        // Mark non-approved milestones as failed
        for (const m of contract.milestones) {
          if (m.status !== "approved") {
            await db.contracts.updateMilestone(id, m.id, { status: "failed" });
          }
        }

        // On-chain: mark failed
        if (isBlockchainConfigured() && contract.onChainAddress) {
          await db.blockchainEvents.tracked(
            { contractId: id, operation: "mark_failed", chain: "arbitrum" },
            async () => {
              const txHash = await markContractFailed(contract.onChainAddress!);
              return { txHash };
            },
          );
        }
      } else {
        return Response.json(
          { error: "Contract cannot be refunded in current state" },
          { status: 400 },
        );
      }
    }

    // Execute refund
    await db.escrows.refund(id);

    // On-chain: refund escrow
    if (isBlockchainConfigured() && contract.onChainAddress) {
      await db.blockchainEvents.tracked(
        { contractId: id, operation: "refund_escrow", chain: "arbitrum" },
        async () => {
          const txHash = await refundEscrowOnChain(contract.onChainAddress!);
          return { txHash };
        },
      );
    }

    const updated = await db.contracts.findById(id);
    const escrow = await db.escrows.findByContract(id);

    // Notify agency that contract was cancelled and refunded
    if (contract.agency) {
      notifyUser(contract.agency, {
        type: "contract_refunded",
        contractTitle: contract.title,
        contractId: id,
        amount: contract.totalValue,
      });
    }

    return Response.json({
      contract: updated,
      escrow,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
