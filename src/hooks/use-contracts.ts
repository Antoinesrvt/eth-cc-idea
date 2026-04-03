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
    { token, walletAddress, skip: waitingForAuth },
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

// ---------- Mutation helpers (all accept optional auth token + wallet) ----------

/** Auth options for API calls — pass token + wallet for proper auth */
interface AuthOpts {
  token?: string | null;
  wallet?: string | null;
}

/** Parse flexible auth args: supports both (token, wallet) positional and { token, wallet } object */
function parseAuth(
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
): { t: string | null | undefined; w: string | null | undefined } {
  if (tokenOrOpts && typeof tokenOrOpts === "object") {
    return { t: tokenOrOpts.token, w: tokenOrOpts.wallet };
  }
  return { t: tokenOrOpts as string | null | undefined, w: wallet };
}

export async function depositEscrow(
  contractId: string,
  data: { amount: number; txHash: string; paymentMethod?: string },
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  return postApi<EscrowState>(`/api/contracts/${contractId}/deposit`, data, t, w);
}

export async function submitDeliverable(
  contractId: string,
  data: { milestoneId: number; proofHash: string; description?: string; links?: string[]; files?: File[] },
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);

  if (data.files && data.files.length > 0) {
    const formData = new FormData();
    formData.append("milestoneId", String(data.milestoneId));
    formData.append("proofHash", data.proofHash);
    if (data.description) formData.append("description", data.description);
    if (data.links) {
      for (const link of data.links) {
        if (link) formData.append("links", link);
      }
    }
    for (const file of data.files) {
      formData.append("files", file);
    }
    return postApi<ServiceContract>(`/api/contracts/${contractId}/deliver`, formData, t, w);
  }

  const { files: _files, ...jsonData } = data;
  return postApi<ServiceContract>(`/api/contracts/${contractId}/deliver`, jsonData, t, w);
}

export async function approveMilestone(
  contractId: string,
  milestoneId: number,
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  return postApi(`/api/contracts/${contractId}/approve`, { milestoneId }, t, w);
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
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  return postApi<ServiceContract>(`/api/contracts/${contractId}/tokenize`, data, t, w);
}

export async function refundContract(
  contractId: string,
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
): Promise<void> {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  await postApi(`/api/contracts/${contractId}/refund`, {}, t, w);
}

export async function rejectMilestone(
  contractId: string,
  milestoneId: number,
  reason: string,
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  return postApi<{ contract: ServiceContract; reason: string }>(
    `/api/contracts/${contractId}/reject`, { milestoneId, reason }, t, w,
  );
}

// ---------- Dispute flow ----------

export async function startDispute(
  contractId: string,
  milestoneId: number,
  argument: string,
  tokenOrOpts?: string | null | AuthOpts,
  wallet?: string | null,
) {
  const { t, w } = parseAuth(tokenOrOpts, wallet);
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "create", milestoneId, argument,
  }, t, w);
}

export async function payKlerosFee(
  contractId: string,
  disputeId: string,
  tokenOrOpts?: string | null | AuthOpts,
) {
  const { t, w } = parseAuth(tokenOrOpts);
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "pay_fee", disputeId,
  }, t, w);
}

export async function submitDisputeEvidence(
  contractId: string,
  disputeId: string,
  evidenceUri: string,
  description: string,
  tokenOrOpts?: string | null | AuthOpts,
) {
  const { t, w } = parseAuth(tokenOrOpts);
  return postApi<Dispute>(`/api/contracts/${contractId}/dispute`, {
    action: "submit_evidence", disputeId, evidenceUri, description,
  }, t, w);
}

export async function checkDisputeDeadline(
  contractId: string,
  disputeId: string,
  tokenOrOpts?: string | null | AuthOpts,
) {
  const { t, w } = parseAuth(tokenOrOpts);
  return postApi<{ dispute: Dispute; expired: boolean; defaultWinner?: "client" | "agency" }>(
    `/api/contracts/${contractId}/dispute`, { action: "check_deadline", disputeId }, t, w,
  );
}


export function useDisputes(contractId: string) {
  return useApi<Dispute[]>(`/api/contracts/${contractId}/dispute`);
}
