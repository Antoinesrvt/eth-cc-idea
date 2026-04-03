export type ContractStatus =
  | "draft"           // created, counterparty entered by address
  | "invited"         // counterparty invited by email, waiting for them to join
  | "pending_deposit" // both parties known, waiting for client escrow deposit
  | "active"          // escrow deposited, work can begin
  | "completed"       // all milestones approved
  | "disputed"        // dispute in progress
  | "cancelled"       // cancelled by creator before activation
  | "failed";

export type MilestoneStatus =
  | "pending"
  | "delivered"
  | "approved"
  | "rejected"
  | "disputed"
  | "failed";

export interface Milestone {
  /** Sequential milestone identifier within a contract */
  id: number;
  name: string;
  description: string;
  /** Amount in USD */
  amount: number;
  deadline?: Date;
  status: MilestoneStatus;
  /** IPFS hash of the deliverable proof */
  proofHash?: string;
  deliveredAt?: Date;
  approvedAt?: Date;
}

export interface ServiceContract {
  /** UUID */
  id: string;
  title: string;
  description: string;
  category: string;
  creatorRole: "agency" | "client";
  /** Wallet address or email of the client */
  client: string;
  /** Wallet address or email of the agency */
  agency: string;
  /** Business development partner wallet/email (optional) */
  bd?: string;
  /** BD fee percentage (0-20, default 0) */
  bdFeePercent: number;
  /** Platform fee percentage (always 2.5) */
  platformFeePercent: number;
  milestones: Milestone[];
  /** Total contract value in USD */
  totalValue: number;
  status: ContractStatus;
  /** IPFS hash of the contract terms PDF */
  termsHash?: string;
  /** On-chain ServiceContract address */
  onChainAddress?: string;
  /** Token address (Uniswap pool token) */
  tokenAddress?: string;
  /** JSON string of TokenizationExposure settings */
  tokenizationExposure?: string;
  /** Unique token for invite link */
  inviteToken?: string;
  /** Counterparty email (if invited by email) */
  inviteEmail?: string;
  /** Which role the invite is for */
  inviteRole?: "client" | "agency";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContractInput {
  title: string;
  description: string;
  category: ServiceContract["category"];
  /** @deprecated Always "agency" — creator is always the agency */
  creatorRole?: "agency" | "client";
  client: string;
  agency: string;
  bd?: string;
  bdFeePercent?: number;
  milestones: Omit<
    Milestone,
    "id" | "status" | "proofHash" | "deliveredAt" | "approvedAt"
  >[];
  termsHash?: string;
  /** Set when counterparty is invited by email */
  inviteToken?: string;
  inviteEmail?: string;
  inviteRole?: "client" | "agency";
  /** Override status (e.g. "invited" when email invite is used) */
  status?: ContractStatus;
}

export const PLATFORM_FEE_PERCENT = 2.5;

// --- Tokenization exposure settings ---

export interface TokenizationExposure {
  showDescription: boolean;
  showMilestones: boolean;
  showDisputeHistory: boolean;
  // title and progress are always shown
  // client info is NEVER shown
}

export const DEFAULT_EXPOSURE: TokenizationExposure = {
  showDescription: false,
  showMilestones: false,
  showDisputeHistory: false,
};
