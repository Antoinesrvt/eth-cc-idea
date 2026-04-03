import type { Dispute, DisputeEvidence, PartyResponse } from "@/lib/types";
import { getDb } from "./client";
import { disputes as disputesTable } from "./schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToDispute(row: typeof disputesTable.$inferSelect): Dispute {
  return {
    id: row.id,
    contractId: row.contractId,
    milestoneId: row.milestoneId,
    phase: row.phase as Dispute["phase"],
    initiatedBy: row.initiatedBy as Dispute["initiatedBy"],
    // aiVerdict column kept in DB for backwards compat but not exposed in type
    partyResponses: JSON.parse(row.partyResponses) as PartyResponse[],
    klerosDisputeId: row.klerosDisputeId ?? undefined,
    arbitrationFee: row.arbitrationFee ?? undefined,
    clientFeePaid: row.clientFeePaid,
    agencyFeePaid: row.agencyFeePaid,
    feeDeadline: row.feeDeadline ? new Date(row.feeDeadline) : undefined,
    ruling: row.ruling as Dispute["ruling"],
    evidence: (JSON.parse(row.evidence) as DisputeEvidence[]).map((e) => ({
      ...e,
      submittedAt: new Date(e.submittedAt),
    })),
    createdAt: new Date(row.createdAt),
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
  };
}

async function loadDispute(id: string): Promise<Dispute | null> {
  const rows = await getDb()
    .select()
    .from(disputesTable)
    .where(eq(disputesTable.id, id));
  const row = rows[0] ?? null;
  return row ? rowToDispute(row) : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createDispute(
  data: Omit<Dispute, "id" | "createdAt">,
): Promise<Dispute> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await getDb().insert(disputesTable).values({
    id,
    contractId: data.contractId,
    milestoneId: data.milestoneId,
    phase: data.phase,
    initiatedBy: data.initiatedBy,
    aiVerdict: null,
    partyResponses: JSON.stringify(data.partyResponses ?? []),
    klerosDisputeId: data.klerosDisputeId ?? null,
    arbitrationFee: data.arbitrationFee ?? null,
    clientFeePaid: data.clientFeePaid ?? false,
    agencyFeePaid: data.agencyFeePaid ?? false,
    feeDeadline: data.feeDeadline?.toISOString() ?? null,
    ruling: data.ruling ?? null,
    evidence: JSON.stringify(data.evidence ?? []),
    createdAt: now,
    resolvedAt: data.resolvedAt?.toISOString() ?? null,
  });

  return (await loadDispute(id))!;
}

export async function findById(id: string): Promise<Dispute | null> {
  return loadDispute(id);
}

export async function findByContract(contractId: string): Promise<Dispute[]> {
  const rows = await getDb()
    .select()
    .from(disputesTable)
    .where(eq(disputesTable.contractId, contractId));
  return rows.map(rowToDispute);
}

export async function update(id: string, data: Partial<Dispute>): Promise<Dispute> {
  const existing = await loadDispute(id);
  if (!existing) {
    throw new Error(`Dispute not found: ${id}`);
  }

  await getDb().update(disputesTable).set({
    ...(data.phase !== undefined && { phase: data.phase }),
    ...(data.partyResponses !== undefined && {
      partyResponses: JSON.stringify(data.partyResponses),
    }),
    ...(data.klerosDisputeId !== undefined && { klerosDisputeId: data.klerosDisputeId ?? null }),
    ...(data.arbitrationFee !== undefined && { arbitrationFee: data.arbitrationFee ?? null }),
    ...(data.clientFeePaid !== undefined && { clientFeePaid: data.clientFeePaid }),
    ...(data.agencyFeePaid !== undefined && { agencyFeePaid: data.agencyFeePaid }),
    ...(data.feeDeadline !== undefined && {
      feeDeadline: data.feeDeadline?.toISOString() ?? null,
    }),
    ...(data.ruling !== undefined && { ruling: data.ruling ?? null }),
    ...(data.evidence !== undefined && { evidence: JSON.stringify(data.evidence) }),
    ...(data.resolvedAt !== undefined && {
      resolvedAt: data.resolvedAt?.toISOString() ?? null,
    }),
  }).where(eq(disputesTable.id, id));

  return (await loadDispute(id))!;
}

export async function addEvidence(
  disputeId: string,
  evidence: DisputeEvidence,
): Promise<Dispute> {
  const dispute = await loadDispute(disputeId);
  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const updated = [...dispute.evidence, evidence];
  await getDb().update(disputesTable).set({
    evidence: JSON.stringify(updated),
  }).where(eq(disputesTable.id, disputeId));

  return (await loadDispute(disputeId))!;
}

/** Record arbitration fee payment for Kleros phase */
export async function recordFeePaid(
  disputeId: string,
  party: "client" | "agency",
): Promise<Dispute> {
  const dispute = await loadDispute(disputeId);
  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  if (dispute.phase !== "kleros_payment") {
    throw new Error(
      `Cannot pay fee in phase "${dispute.phase}"`,
    );
  }

  if (party === "client") {
    if (dispute.clientFeePaid) {
      throw new Error("Client has already paid the arbitration fee");
    }
    await getDb().update(disputesTable).set({ clientFeePaid: true })
      .where(eq(disputesTable.id, disputeId));
  } else {
    if (dispute.agencyFeePaid) {
      throw new Error("Agency has already paid the arbitration fee");
    }
    await getDb().update(disputesTable).set({ agencyFeePaid: true })
      .where(eq(disputesTable.id, disputeId));
  }

  return (await loadDispute(disputeId))!;
}

/** Check if the fee deadline has passed and determine default winner */
export async function checkFeeDeadline(
  disputeId: string,
): Promise<{ expired: boolean; defaultWinner?: "client" | "agency" }> {
  const dispute = await loadDispute(disputeId);
  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  if (dispute.phase !== "kleros_payment" || !dispute.feeDeadline) {
    return { expired: false };
  }

  const now = new Date();
  if (now < dispute.feeDeadline) {
    return { expired: false };
  }

  if (dispute.clientFeePaid && !dispute.agencyFeePaid) {
    return { expired: true, defaultWinner: "client" };
  }
  if (dispute.agencyFeePaid && !dispute.clientFeePaid) {
    return { expired: true, defaultWinner: "agency" };
  }

  return { expired: true };
}
