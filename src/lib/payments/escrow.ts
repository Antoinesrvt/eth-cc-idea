import type { EscrowDeposit } from "@/lib/types";
import { PAYMENTS_CONFIG } from "./config";

const PLATFORM_FEE = PAYMENTS_CONFIG.platformFeePercent;

// Calculate fee breakdown for a milestone release
export function calculateFeeBreakdown(
  milestoneAmount: number,
  bdFeePercent: number,
): {
  platformFee: number;
  bdFee: number;
  agencyPayout: number;
  platformFeeBps: number;
  bdFeeBps: number;
} {
  const platformFee = milestoneAmount * (PLATFORM_FEE / 100);
  const bdFee = milestoneAmount * (bdFeePercent / 100);
  const agencyPayout = milestoneAmount - platformFee - bdFee;
  return {
    platformFee,
    bdFee,
    agencyPayout,
    platformFeeBps: PLATFORM_FEE * 100, // 250 bps
    bdFeeBps: bdFeePercent * 100,
  };
}

// Validate escrow deposit amount
export function validateDeposit(
  totalRequired: number,
  currentDeposited: number,
  depositAmount: number,
): {
  valid: boolean;
  error?: string;
  remaining: number;
} {
  const remaining = totalRequired - currentDeposited;
  if (depositAmount <= 0)
    return { valid: false, error: "Amount must be positive", remaining };
  if (depositAmount > remaining)
    return {
      valid: false,
      error: `Deposit exceeds remaining: ${remaining}`,
      remaining,
    };
  return { valid: true, remaining: remaining - depositAmount };
}

// Create a deposit record (to be called after on-chain tx confirms)
export function createDepositRecord(params: {
  amount: number;
  txHash: string;
}): Omit<EscrowDeposit, "id"> {
  return {
    amount: params.amount,
    method: "crypto",
    txHash: params.txHash,
    confirmedAt: new Date(),
  };
}

// Calculate how much can be released for a milestone
export function calculateMilestoneRelease(
  milestoneAmount: number,
  bdFeePercent: number,
): {
  total: number;
  toAgency: number;
  toBd: number;
  toPlatform: number;
} {
  const { platformFee, bdFee, agencyPayout } = calculateFeeBreakdown(
    milestoneAmount,
    bdFeePercent,
  );
  return {
    total: milestoneAmount,
    toAgency: agencyPayout,
    toBd: bdFee,
    toPlatform: platformFee,
  };
}
