import type {
  ServiceContract,
  CreateContractInput,
  Milestone,
} from "@/lib/types";
import { getDb } from "./client";
import { contracts as contractsTable, milestones as milestonesTable } from "./schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers: row <-> domain object conversion
// ---------------------------------------------------------------------------

function rowToContract(
  row: typeof contractsTable.$inferSelect,
  milestoneRows: (typeof milestonesTable.$inferSelect)[],
): ServiceContract {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as ServiceContract["category"],
    creatorRole: row.creatorRole as ServiceContract["creatorRole"],
    client: row.client,
    agency: row.agency,
    bd: row.bd ?? undefined,
    bdFeePercent: row.bdFeePercent,
    platformFeePercent: row.platformFeePercent,
    milestones: milestoneRows
      .sort((a, b) => a.id - b.id)
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        amount: m.amount,
        deadline: m.deadline ? new Date(m.deadline) : undefined,
        status: m.status as Milestone["status"],
        proofHash: m.proofHash ?? undefined,
        deliveredAt: m.deliveredAt ? new Date(m.deliveredAt) : undefined,
        approvedAt: m.approvedAt ? new Date(m.approvedAt) : undefined,
      })),
    totalValue: row.totalValue,
    status: row.status as ServiceContract["status"],
    termsHash: row.termsHash ?? undefined,
    onChainAddress: row.onChainAddress ?? undefined,
    tokenAddress: row.tokenAddress ?? undefined,
    tokenizationExposure: row.tokenizationExposure ?? undefined,
    inviteToken: row.inviteToken ?? undefined,
    inviteEmail: row.inviteEmail ?? undefined,
    inviteRole: (row.inviteRole as ServiceContract["inviteRole"]) ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function loadContract(id: string): Promise<ServiceContract | null> {
  const rows = await getDb()
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, id));
  const row = rows[0] ?? null;
  if (!row) return null;

  const ms = await getDb()
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.contractId, id));

  return rowToContract(row, ms);
}

// ---------------------------------------------------------------------------
// Public API (same signatures as before)
// ---------------------------------------------------------------------------

export async function createContract(input: CreateContractInput): Promise<ServiceContract> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const milestones: Milestone[] = input.milestones.map((m, idx) => ({
    ...m,
    id: idx + 1,
    status: "pending" as const,
  }));

  const totalValue = milestones.reduce((sum, m) => sum + m.amount, 0);

  await getDb().insert(contractsTable).values({
    id,
    title: input.title,
    description: input.description,
    category: input.category,
    creatorRole: input.creatorRole ?? "agency",
    client: input.client,
    agency: input.agency,
    bd: input.bd ?? null,
    bdFeePercent: input.bdFeePercent ?? 0,
    platformFeePercent: 2.5,
    totalValue,
    status: input.status ?? "draft",
    termsHash: input.termsHash ?? null,
    inviteToken: input.inviteToken ?? null,
    inviteEmail: input.inviteEmail ?? null,
    inviteRole: input.inviteRole ?? null,
    createdAt: now,
    updatedAt: now,
  });

  for (const m of milestones) {
    await getDb().insert(milestonesTable).values({
      contractId: id,
      id: m.id,
      name: m.name,
      description: m.description,
      amount: m.amount,
      deadline: m.deadline?.toISOString() ?? null,
      status: m.status,
    });
  }

  return (await loadContract(id))!;
}

export async function findById(id: string): Promise<ServiceContract | null> {
  return loadContract(id);
}

export async function findByInviteToken(token: string): Promise<ServiceContract | null> {
  const rows = await getDb()
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.inviteToken, token));
  const row = rows[0] ?? null;
  if (!row) return null;

  const ms = await getDb()
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.contractId, row.id));

  return rowToContract(row, ms);
}

export async function findByUser(address: string): Promise<ServiceContract[]> {
  const rows = await getDb()
    .select()
    .from(contractsTable);

  const addr = address.toLowerCase();
  const filtered = rows.filter(
    (r) => r.client?.toLowerCase() === addr || r.agency?.toLowerCase() === addr,
  );
  const results: ServiceContract[] = [];
  for (const r of filtered) {
    const ms = await getDb()
      .select()
      .from(milestonesTable)
      .where(eq(milestonesTable.contractId, r.id));
    results.push(rowToContract(r, ms));
  }
  return results;
}

export async function update(
  id: string,
  data: Partial<ServiceContract>,
): Promise<ServiceContract> {
  const existing = await loadContract(id);
  if (!existing) {
    throw new Error(`Contract not found: ${id}`);
  }

  const now = new Date().toISOString();

  await getDb().update(contractsTable).set({
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.termsHash !== undefined && { termsHash: data.termsHash ?? null }),
    ...(data.onChainAddress !== undefined && { onChainAddress: data.onChainAddress ?? null }),
    ...(data.tokenAddress !== undefined && { tokenAddress: data.tokenAddress ?? null }),
    ...(data.bdFeePercent !== undefined && { bdFeePercent: data.bdFeePercent }),
    ...(data.bd !== undefined && { bd: data.bd ?? null }),
    ...(data.tokenizationExposure !== undefined && { tokenizationExposure: data.tokenizationExposure ?? null }),
    ...(data.client !== undefined && { client: data.client }),
    ...(data.agency !== undefined && { agency: data.agency }),
    ...(data.inviteToken !== undefined && { inviteToken: data.inviteToken ?? null }),
    ...(data.inviteEmail !== undefined && { inviteEmail: data.inviteEmail ?? null }),
    ...(data.inviteRole !== undefined && { inviteRole: data.inviteRole ?? null }),
    updatedAt: now,
  }).where(eq(contractsTable.id, id));

  return (await loadContract(id))!;
}

export async function updateMilestone(
  contractId: string,
  milestoneId: number,
  data: Partial<Milestone>,
): Promise<ServiceContract> {
  const contract = await loadContract(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  const milestone = contract.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    throw new Error(
      `Milestone ${milestoneId} not found in contract ${contractId}`,
    );
  }

  await getDb().update(milestonesTable).set({
    ...(data.status !== undefined && { status: data.status }),
    ...(data.proofHash !== undefined && { proofHash: data.proofHash ?? null }),
    ...(data.deliveredAt !== undefined && { deliveredAt: data.deliveredAt?.toISOString() ?? null }),
    ...(data.approvedAt !== undefined && { approvedAt: data.approvedAt?.toISOString() ?? null }),
  }).where(
    and(
      eq(milestonesTable.contractId, contractId),
      eq(milestonesTable.id, milestoneId),
    )
  );

  // Update contract's updatedAt
  await getDb().update(contractsTable).set({
    updatedAt: new Date().toISOString(),
  }).where(eq(contractsTable.id, contractId));

  return (await loadContract(contractId))!;
}

export async function list(): Promise<ServiceContract[]> {
  const rows = await getDb().select().from(contractsTable);
  const results: ServiceContract[] = [];
  for (const r of rows) {
    const ms = await getDb()
      .select()
      .from(milestonesTable)
      .where(eq(milestonesTable.contractId, r.id));
    results.push(rowToContract(r, ms));
  }
  return results;
}
