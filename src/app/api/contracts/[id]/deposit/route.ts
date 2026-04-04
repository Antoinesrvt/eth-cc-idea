import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateDeposit, createDepositRecord } from "@/lib/payments/escrow";
import { depositEscrow, isBlockchainConfigured } from "@/lib/blockchain";

const DepositSchema = z.object({
  amount: z.number().positive(),
  txHash: z.string().optional(), // Optional — chain provides real txHash
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const contract = await db.contracts.findById(id);
    if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });

    const escrow = await db.escrows.findByContract(id);
    if (!escrow) return Response.json({ error: "Escrow not found" }, { status: 404 });

    if (escrow.depositedAmount >= escrow.totalAmount) {
      return Response.json({ error: "Escrow already fully funded" }, { status: 400 });
    }

    const validation = validateDeposit(escrow.totalAmount, escrow.depositedAmount, parsed.data.amount);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    let txHash = parsed.data.txHash || `db_${Date.now().toString(36)}`;

    // ── Chain-first: if contract is on-chain, deposit must succeed on-chain ──
    if (contract.onChainAddress && isBlockchainConfigured()) {
      try {
        txHash = await depositEscrow(
          contract.onChainAddress,
          BigInt(Math.round(parsed.data.amount * 1e18)),
        );
        console.log("[deposit] On-chain success:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "On-chain deposit failed";
        console.error("[deposit] On-chain FAILED:", msg);
        return Response.json(
          { error: `Deposit failed on-chain: ${msg}. Please ensure you have approved USDC spending.` },
          { status: 500 },
        );
      }
    }

    // ── DB: record deposit only after chain succeeds ──
    const depositRecord = createDepositRecord({ amount: parsed.data.amount, txHash });
    const updatedEscrow = await db.escrows.addDeposit(id, depositRecord);

    if (updatedEscrow.depositedAmount >= updatedEscrow.totalAmount) {
      await db.contracts.update(id, { status: "active" });
    }

    return Response.json({ ...updatedEscrow, txHash });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
