"use client";

import { useState, useCallback, useEffect } from "react";
import { useApi, postApi } from "./use-api";
import { useAuth } from "./use-auth";
import type {
  ServiceContract,
  CreateContractInput,
  EscrowState,
  Dispute,
  TokenizationExposure,
} from "@/lib/types";

// ---------- Contract detail (single) ----------

export interface BlockchainEvent {
  id: string;
  contractId: string;
  operation: string;
  status: "pending" | "confirmed" | "failed";
  chain: string;
  txHash?: string;
  errorMessage?: string;
  params: Record<string, unknown>;
  createdAt: string;
  confirmedAt?: string;
}

interface ContractDetail extends ServiceContract {
  escrow?: EscrowState;
  disputes?: Dispute[];
  blockchainEvents?: BlockchainEvent[];
}

export function useContract(id: string) {
  const { getAuthToken, authenticated, ready, walletAddress } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (ready && authenticated) {
      getAuthToken().then(setToken);
    }
  }, [ready, authenticated, getAuthToken]);

  // Wait for auth to resolve before the first request to avoid a 403 flash
  const waitingForAuth = !ready || (authenticated && !token);

  const { data, loading, error, refresh } = useApi<ContractDetail>(
    `/api/contracts/${id}`,
    { skip: waitingForAuth },
  );

  return {
    contract: data,
    escrow: data?.escrow ?? null,
    disputes: data?.disputes ?? [],
    blockchainEvents: data?.blockchainEvents ?? [],
    loading: waitingForAuth || loading,
    error,
    refresh,
  };
}

// ---------- Contract list ----------

export function useContracts(userAddress?: string) {
  const url = userAddress
    ? `/api/contracts?user=${userAddress}`
    : "/api/contracts";

  const { data, loading, error, refresh } = useApi<ServiceContract[]>(url);

  return {
    contracts: data ?? [],
    loading,
    error,
    refresh,
  };
}

// ---------- Create contract ----------

export function useCreateContract() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateContractInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await postApi<ServiceContract>("/api/contracts", input);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create contract";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

// ---------- Mutation helpers (auth handled globally by use-api) ----------

export async function depositEscrow(
  contractId: string,
  data: { amount: number; txHash: string; paymentMethod?: string },
) {
  return postApi<EscrowState>(`/api/contracts/${contractId}/deposit`, data);
}

export async function submitDeliverable(
  contractId: string,
  data: { milestoneId: number; proofHash: string; description?: string; links?: string[] },
) {
  return postApi<ServiceContract>(`/api/contracts/${contractId}/deliver`, data);
}

export async function approveMilestone(contractId: string, milestoneId: number) {
  return postApi(`/api/contracts/${contractId}/approve`, { milestoneId });
}

export async function tokenizeContract(
  contractId: string,
  data: {
    tokenName: string;
    tokenSymbol: string;
    totalSupply: number;
    pricePerToken: number;
    exposure?: TokenizationExposure;
  },
) {
  return postApi<ServiceContract>(`/api/contracts/${contractId}/tokenize`, data);
}

export async function refundContract(contractId: string): Promise<void> {
  await postApi(`/api/contracts/${contractId}/refund`, {});
}

export async function rejectMilestone(contractId: string, milestoneId: number, reason: string) {
  return postApi<{ contract: ServiceContract; reason: string }>(
    `/api/contracts/${contractId}/reject`, { milestoneId, reason },
  );
}

// ---------- Dispute flow ----------

export async function startDispute(contractId: string, milestoneId: number, argument: string) {
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "create", milestoneId, argument,
  });
}

export async function payKlerosFee(contractId: string, disputeId: string) {
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "pay_fee", disputeId,
  });
}

export async function submitDisputeEvidence(contractId: string, disputeId: string, evidenceUri: string, description: string) {
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "submit_evidence", disputeId, evidenceUri, description,
  });
}

export async function checkDisputeDeadline(contractId: string, disputeId: string) {
  return postApi<{ dispute: Dispute; expired: boolean; defaultWinner?: "client" | "agency" }>(
    `/api/contracts/${contractId}/dispute`, { action: "check_deadline", disputeId },
  );
}


export function useDisputes(contractId: string) {
  return useApi<Dispute[]>(`/api/contracts/${contractId}/dispute`);
}
