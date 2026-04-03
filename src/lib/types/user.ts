export type UserRole = "agency" | "client" | "investor" | "bd";

export interface AgencyProfile {
  // Identity
  companyName?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  categories?: string[];
  // Stats
  score: number;
  contractsCompleted: number;
  contractsFailed: number;
  disputesWon: number;
  disputesLost: number;
  totalVolume: number;
  verified: boolean;
  attestations: { label: string; verified: boolean; hash?: string }[];
}

export interface TeamMember {
  memberAddress: string;
  memberName?: string;
  memberEmail?: string;
  role: "owner" | "admin" | "member";
  invitedAt: Date;
  acceptedAt?: Date;
}

export interface UserProfile {
  address: string;
  name?: string;
  email?: string;
  roles: UserRole[];
  agencyProfile?: AgencyProfile;
  team?: TeamMember[];
  createdAt: Date;
}
