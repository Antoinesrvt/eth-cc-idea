"use client";

import { useApi } from "./use-api";

export interface MarketplaceListing {
  tokenId: string;
  tokenAddress: string;
  title: string;
  category: string;
  totalValue: number;
  status: string;
  progress: number;
  completedMilestones: number;
  totalMilestones: number;
  avgScore: number;
  agency: {
    address: string;
    name: string | null;
    score: number | null;
    verified: boolean;
  };
  createdAt: string;
}

export interface TokenDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  totalValue: number;
  status: string;
  progress: number;
  completedMilestones: number;
  totalMilestones: number;
  // Only present if agency enabled showMilestones
  milestones?: Array<{
    id: number;
    name: string;
    description: string;
    amount: number;
    status: string;
    deliveredAt?: string;
    approvedAt?: string;
    proofHash?: string;
  }>;
  tokenAddress?: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  pricePerToken: number;
  exposure: {
    showDescription: boolean;
    showMilestones: boolean;
    showDisputeHistory: boolean;
  };
  escrow?: {
    totalAmount: number;
    depositedAmount: number;
    released: number;
    balance: number;
    status: string;
  } | null;
  // Only present if agency enabled showDisputeHistory
  disputes?: Array<{
    id: string;
    status: string;
    phase: string;
    milestoneId: number;
    createdAt: string;
    resolvedAt?: string;
  }>;
  agency: {
    address: string;
    name: string | null;
    score: number | null;
    verified: boolean;
  };
  // client is always null on marketplace (privacy)
  client: { address: null; name: null };
  createdAt: string;
}

export function useMarketplace() {
  const { data, loading, error, refresh } =
    useApi<MarketplaceListing[]>("/api/marketplace");

  return {
    listings: data ?? [],
    loading,
    error,
    refresh,
  };
}

export function useTokenDetail(tokenId: string) {
  const { data, loading, error, refresh } = useApi<TokenDetail>(
    tokenId ? `/api/marketplace/${tokenId}` : null,
  );

  return {
    token: data,
    loading,
    error,
    refresh,
  };
}
