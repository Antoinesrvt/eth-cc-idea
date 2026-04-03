import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateDeposit, createDepositRecord } from "@/lib/payments/escrow";
import { depositEscrow, isBlockchainConfigured } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

const DepositSchema = z.object({
  amount: z.number().positive(),
  txHash: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only the client can deposit escrow
    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const escrow = await db.escrows.findByContract(id);
    if (!escrow) {
      return Response.json(
        { error: "Escrow not found for contract" },
        { status: 404 },
      );
    }

    // Reject if escrow is already fully funded
    if (escrow.depositedAmount >= escrow.totalAmount) {
      return Response.json(
        { error: "Escrow is already fully funded" },
        { status: 400 },
      );
    }

    const validation = validateDeposit(
      escrow.totalAmount,
      escrow.depositedAmount,
      parsed.data.amount,
    );

    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const depositRecord = createDepositRecord({
      amount: parsed.data.amount,
      txHash: parsed.data.txHash,
    });

    const updatedEscrow = await db.escrows.addDeposit(id, depositRecord);

    if (updatedEscrow.depositedAmount >= updatedEscrow.totalAmount) {
      await db.contracts.update(id, { status: "active" });
    }

    // Attempt real on-chain deposit if blockchain is configured
    if (isBlockchainConfigured()) {
      const contract = await db.contracts.findById(id);
      if (contract?.onChainAddress) {
        await db.blockchainEvents.tracked(
          { contractId: id, operation: "deposit", chain: "arbitrum", params: { amount: parsed.data.amount } },
          async () => {
            const txHash = await depositEscrow(contract.onChainAddress!, BigInt(Math.round(parsed.data.amount * 1e18)));
            return { txHash };
          },
        );
      }
    }

    // Notify agency that escrow was deposited
    const contract = await db.contracts.findById(id);
    if (contract?.agency) {
      notifyUser(contract.agency, {
        type: "escrow_deposited",
        contractTitle: contract.title,
        contractId: id,
        amount: parsed.data.amount,
      });
    }

    return Response.json(updatedEscrow);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
