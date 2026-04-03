import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  serial,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  creatorRole: text("creator_role").notNull(),
  client: text("client").notNull(),
  agency: text("agency").notNull(),
  bd: text("bd"),
  bdFeePercent: real("bd_fee_percent").notNull().default(0),
  platformFeePercent: real("platform_fee_percent").notNull().default(2.5),
  totalValue: real("total_value").notNull(),
  status: text("status").notNull().default("draft"),
  termsHash: text("terms_hash"),
  onChainAddress: text("on_chain_address"),
  tokenAddress: text("token_address"),
  tokenizationExposure: text("tokenization_exposure"),
  inviteToken: text("invite_token"),
  inviteEmail: text("invite_email"),
  inviteRole: text("invite_role"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const milestones = pgTable("milestones", {
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  id: integer("id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  deadline: text("deadline"),
  status: text("status").notNull().default("pending"),
  proofHash: text("proof_hash"),
  aiScore: integer("ai_score"),
  deliveredAt: text("delivered_at"),
  approvedAt: text("approved_at"),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  address: text("address").primaryKey(),
  name: text("name"),
  email: text("email"),
  roles: text("roles").notNull(),
  createdAt: text("created_at").notNull(),
  unlinkMnemonic: text("unlink_mnemonic"),
});

export const agencyProfiles = pgTable("agency_profiles", {
  address: text("address").primaryKey().references(() => users.address, { onDelete: "cascade" }),
  score: real("score").notNull().default(0),
  contractsCompleted: integer("contracts_completed").notNull().default(0),
  contractsFailed: integer("contracts_failed").notNull().default(0),
  disputesWon: integer("disputes_won").notNull().default(0),
  disputesLost: integer("disputes_lost").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  avgAiScore: real("avg_ai_score").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  attestations: text("attestations").notNull().default("[]"),
  companyName: text("company_name"),
  description: text("description"),
  website: text("website"),
  logoUrl: text("logo_url"),
  categories: text("categories").notNull().default("[]"),
});

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export const disputes = pgTable("disputes", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  milestoneId: integer("milestone_id").notNull(),
  phase: text("phase").notNull(),
  initiatedBy: text("initiated_by").notNull(),
  aiVerdict: text("ai_verdict"),
  partyResponses: text("party_responses").notNull().default("[]"),
  klerosDisputeId: text("kleros_dispute_id"),
  arbitrationFee: real("arbitration_fee"),
  clientFeePaid: boolean("client_fee_paid").notNull().default(false),
  agencyFeePaid: boolean("agency_fee_paid").notNull().default(false),
  feeDeadline: text("fee_deadline"),
  ruling: integer("ruling"),
  evidence: text("evidence").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

// ---------------------------------------------------------------------------
// Escrows
// ---------------------------------------------------------------------------

export const escrows = pgTable("escrows", {
  contractId: text("contract_id").primaryKey(),
  totalAmount: real("total_amount").notNull(),
  depositedAmount: real("deposited_amount").notNull().default(0),
  releasedAmount: real("released_amount").notNull().default(0),
  status: text("status").notNull().default("pending"),
  deposits: text("deposits").notNull().default("[]"),
});
