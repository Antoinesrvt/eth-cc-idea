import type { UserProfile, UserRole, AgencyProfile } from "@/lib/types";
import { getDb } from "./client";
import { users as usersTable, agencyProfiles as agencyProfilesTable } from "./schema";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToUser(
  row: typeof usersTable.$inferSelect,
  profileRow?: typeof agencyProfilesTable.$inferSelect | null,
): UserProfile {
  const user: UserProfile = {
    address: row.address,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    roles: JSON.parse(row.roles) as UserRole[],
    createdAt: new Date(row.createdAt),
  };

  if (profileRow) {
    user.agencyProfile = {
      companyName: profileRow.companyName ?? undefined,
      description: profileRow.description ?? undefined,
      website: profileRow.website ?? undefined,
      categories: profileRow.categories ? JSON.parse(profileRow.categories) : [],
      score: profileRow.score,
      contractsCompleted: profileRow.contractsCompleted,
      contractsFailed: profileRow.contractsFailed,
      disputesWon: profileRow.disputesWon,
      disputesLost: profileRow.disputesLost,
      totalVolume: profileRow.totalVolume,
      verified: profileRow.verified,
      attestations: JSON.parse(profileRow.attestations),
    };
  }

  return user;
}

async function loadUser(address: string): Promise<UserProfile | null> {
  const rows = await getDb()
    .select()
    .from(usersTable)
    .where(eq(usersTable.address, address));
  const row = rows[0] ?? null;
  if (!row) return null;

  const profileRows = await getDb()
    .select()
    .from(agencyProfilesTable)
    .where(eq(agencyProfilesTable.address, address));
  const profile = profileRows[0] ?? null;

  return rowToUser(row, profile);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createUser(data: {
  address: string;
  name?: string;
  email?: string;
  roles: UserRole[];
}): Promise<UserProfile> {
  const now = new Date().toISOString();

  await getDb().insert(usersTable).values({
    address: data.address,
    name: data.name ?? null,
    email: data.email ?? null,
    roles: JSON.stringify(data.roles),
    createdAt: now,
  });

  return (await loadUser(data.address))!;
}

export async function findByAddress(address: string): Promise<UserProfile | null> {
  return loadUser(address);
}

/** List all users who have the "agency" role */
export async function listAgencies(): Promise<UserProfile[]> {
  const rows = await getDb()
    .select()
    .from(usersTable)
    .where(sql`${usersTable.roles} LIKE '%agency%'`);
  // Load full profiles with agency data
  const profiles = await Promise.all(rows.map((r) => loadUser(r.address)));
  return profiles.filter((p): p is UserProfile => p !== null);
}

export async function updateAgencyScore(
  address: string,
  update: Partial<AgencyProfile>,
): Promise<UserProfile> {
  const user = await loadUser(address);
  if (!user) {
    throw new Error(`User not found: ${address}`);
  }

  const existing: AgencyProfile = user.agencyProfile ?? {
    score: 0,
    contractsCompleted: 0,
    contractsFailed: 0,
    disputesWon: 0,
    disputesLost: 0,
    totalVolume: 0,
    verified: false,
    attestations: [],
  };

  const merged = { ...existing, ...update };

  // Check if profile exists
  const profileRows = await getDb()
    .select()
    .from(agencyProfilesTable)
    .where(eq(agencyProfilesTable.address, address));
  const profileExists = profileRows[0] ?? null;

  const dbValues = {
    score: merged.score,
    contractsCompleted: merged.contractsCompleted,
    contractsFailed: merged.contractsFailed,
    disputesWon: merged.disputesWon,
    disputesLost: merged.disputesLost,
    totalVolume: merged.totalVolume,
    verified: merged.verified,
    attestations: JSON.stringify(merged.attestations),
    companyName: merged.companyName ?? null,
    description: merged.description ?? null,
    website: merged.website ?? null,
    categories: JSON.stringify(merged.categories ?? []),
  };

  if (profileExists) {
    await getDb().update(agencyProfilesTable).set(dbValues).where(eq(agencyProfilesTable.address, address));
  } else {
    await getDb().insert(agencyProfilesTable).values({ address, ...dbValues });
  }

  return (await loadUser(address))!;
}

export async function upsert(
  address: string,
  data: Partial<UserProfile>,
): Promise<UserProfile> {
  const existing = await loadUser(address);

  if (existing) {
    await getDb().update(usersTable).set({
      ...(data.name !== undefined && { name: data.name ?? null }),
      ...(data.email !== undefined && { email: data.email ?? null }),
      ...(data.roles !== undefined && { roles: JSON.stringify(data.roles) }),
    }).where(eq(usersTable.address, address));

    if (data.agencyProfile) {
      await updateAgencyScore(address, data.agencyProfile);
    }

    return (await loadUser(address))!;
  }

  const now = new Date().toISOString();

  await getDb().insert(usersTable).values({
    address,
    name: data.name ?? null,
    email: data.email ?? null,
    roles: JSON.stringify(data.roles ?? []),
    createdAt: data.createdAt?.toISOString() ?? now,
  });

  if (data.agencyProfile) {
    await updateAgencyScore(address, data.agencyProfile);
  }

  return (await loadUser(address))!;
}
