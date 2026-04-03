import type { EscrowState, EscrowDeposit } from "@/lib/types";
import { getDb } from "./client";
import { escrows as escrowsTable } from "./schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEscrow(row: typeof escrowsTable.$inferSelect): EscrowState {
  return {
    contractId: row.contractId,
    totalAmount: row.totalAmount,
    depositedAmount: row.depositedAmount,
    releasedAmount: row.releasedAmount,
    status: row.status as EscrowState["status"],
    deposits: JSON.parse(row.deposits) as EscrowDeposit[],
  };
}

async function loadEscrow(contractId: string): Promise<EscrowState | null> {
  const rows = await getDb()
    .select()
    .from(escrowsTable)
    .where(eq(escrowsTable.contractId, contractId));
  const row = rows[0] ?? null;
  return row ? rowToEscrow(row) : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createEscrow(
  contractId: string,
  totalAmount: number,
): Promise<EscrowState> {
  await getDb().insert(escrowsTable).values({
    contractId,
    totalAmount,
    depositedAmount: 0,
    releasedAmount: 0,
    status: "pending",
    deposits: "[]",
  });

  return (await loadEscrow(contractId))!;
}

export async function findByContract(contractId: string): Promise<EscrowState | null> {
  return loadEscrow(contractId);
}

export async function addDeposit(
  contractId: string,
  deposit: Omit<EscrowDeposit, "id">,
): Promise<EscrowState> {
  const escrow = await loadEscrow(contractId);
  if (!escrow) {
    throw new Error(`Escrow not found for contract: ${contractId}`);
  }

  const fullDeposit: EscrowDeposit = {
    ...deposit,
    id: crypto.randomUUID(),
  };

  const deposits = [...escrow.deposits, fullDeposit];
  const depositedAmount = escrow.depositedAmount + deposit.amount;
  const status = depositedAmount >= escrow.totalAmount ? "deposited" : escrow.status;

  await getDb().update(escrowsTable).set({
    deposits: JSON.stringify(deposits),
    depositedAmount,
    status,
  }).where(eq(escrowsTable.contractId, contractId));

  return (await loadEscrow(contractId))!;
}

export async function release(
  contractId: string,
  amount: number,
): Promise<EscrowState> {
  const escrow = await loadEscrow(contractId);
  if (!escrow) {
    throw new Error(`Escrow not found for contract: ${contractId}`);
  }

  const available = escrow.depositedAmount - escrow.releasedAmount;
  if (amount > available) {
    throw new Error(
      `Insufficient escrow balance: requested ${amount}, available ${available}`,
    );
  }

  const releasedAmount = escrow.releasedAmount + amount;
  let status: EscrowState["status"];
  if (releasedAmount >= escrow.totalAmount) {
    status = "fully_released";
  } else if (releasedAmount > 0) {
    status = "partially_released";
  } else {
    status = escrow.status;
  }

  await getDb().update(escrowsTable).set({
    releasedAmount,
    status,
  }).where(eq(escrowsTable.contractId, contractId));

  return (await loadEscrow(contractId))!;
}

export async function refund(contractId: string): Promise<EscrowState> {
  const escrow = await loadEscrow(contractId);
  if (!escrow) {
    throw new Error(`Escrow not found for contract: ${contractId}`);
  }

  await getDb().update(escrowsTable).set({
    status: "refunded",
  }).where(eq(escrowsTable.contractId, contractId));

  return (await loadEscrow(contractId))!;
}
