import { getDb } from "./client";
import { sql } from "drizzle-orm";

/**
 * Ensure all tables exist in the database.
 *
 * Uses Drizzle's execute with raw SQL for table creation.
 * Schema is defined in schema.ts — this just ensures tables exist on first run.
 *
 * For proper migrations, use: npx drizzle-kit push
 */
export async function ensureTables() {
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      creator_role TEXT NOT NULL,
      client TEXT NOT NULL,
      agency TEXT NOT NULL,
      bd TEXT,
      bd_fee_percent REAL NOT NULL DEFAULT 0,
      platform_fee_percent REAL NOT NULL DEFAULT 2.5,
      total_value REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      terms_hash TEXT,
      on_chain_address TEXT,
      token_address TEXT,
      tokenization_exposure TEXT,
      invite_token TEXT,
      invite_email TEXT,
      invite_role TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS milestones (
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      proof_hash TEXT,
      ai_score INTEGER,
      delivered_at TEXT,
      approved_at TEXT,
      PRIMARY KEY (contract_id, id)
    )
  `);

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      address TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      roles TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS agency_profiles (
      address TEXT PRIMARY KEY REFERENCES users(address) ON DELETE CASCADE,
      score REAL NOT NULL DEFAULT 0,
      contracts_completed INTEGER NOT NULL DEFAULT 0,
      contracts_failed INTEGER NOT NULL DEFAULT 0,
      disputes_won INTEGER NOT NULL DEFAULT 0,
      disputes_lost INTEGER NOT NULL DEFAULT 0,
      total_volume REAL NOT NULL DEFAULT 0,
      avg_ai_score REAL NOT NULL DEFAULT 0,
      verified BOOLEAN NOT NULL DEFAULT false,
      attestations TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      milestone_id INTEGER NOT NULL,
      phase TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      ai_verdict TEXT,
      party_responses TEXT NOT NULL DEFAULT '[]',
      kleros_dispute_id TEXT,
      arbitration_fee REAL,
      client_fee_paid BOOLEAN NOT NULL DEFAULT false,
      agency_fee_paid BOOLEAN NOT NULL DEFAULT false,
      fee_deadline TEXT,
      ruling INTEGER,
      evidence TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `);

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS escrows (
      contract_id TEXT PRIMARY KEY,
      total_amount REAL NOT NULL,
      deposited_amount REAL NOT NULL DEFAULT 0,
      released_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      deposits TEXT NOT NULL DEFAULT '[]'
    )
  `);

  

  

  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS investor_holdings (
      id SERIAL PRIMARY KEY,
      investor_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      amount REAL NOT NULL,
      buy_price REAL NOT NULL,
      current_price REAL NOT NULL
    )
  `);

  

  

  // Team members table
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      agency_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
      member_address TEXT NOT NULL,
      member_name TEXT,
      member_email TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      invited_at TEXT NOT NULL,
      accepted_at TEXT
    )
  `);

  // Safe ALTER TABLE for new agency_profiles columns (idempotent)
  const safeAlter = async (table: string, column: string, type: string) => {
    try {
      await getDb().execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`));
    } catch { /* column may already exist */ }
  };
  await safeAlter("agency_profiles", "company_name", "TEXT");
  await safeAlter("agency_profiles", "description", "TEXT");
  await safeAlter("agency_profiles", "website", "TEXT");
  await safeAlter("agency_profiles", "logo_url", "TEXT");
  await safeAlter("agency_profiles", "categories", "TEXT NOT NULL DEFAULT '[]'");

  // Indexes
  await getDb().execute(sql`CREATE INDEX IF NOT EXISTS idx_milestones_contract ON milestones(contract_id)`);
  await getDb().execute(sql`CREATE INDEX IF NOT EXISTS idx_disputes_contract ON disputes(contract_id)`);
}
