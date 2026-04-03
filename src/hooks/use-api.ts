"use client";

import { useState, useEffect, useCallback } from "react";

interface UseApiOptions {
  /** Skip the initial fetch (useful for conditional fetching) */
  skip?: boolean;
  /** Auth token to send in Authorization header */
  token?: string | null;
  /** Wallet address fallback — sent as X-Wallet-Address header */
  walletAddress?: string | null;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useApi<T>(
  url: string | null,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refresh = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!url || options.skip) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {};
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }
    if (options.walletAddress) {
      headers["X-Wallet-Address"] = options.walletAddress;
    }

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, options.skip, options.token, options.walletAddress, trigger]);

  return { data, loading, error, refresh };
}

export async function postApi<T>(
  url: string,
  body: unknown,
  token?: string | null,
  walletAddress?: string | null,
): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (walletAddress) {
    headers["X-Wallet-Address"] = walletAddress;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  // Show toast warnings for failed blockchain operations
  if (json.blockchainWarnings?.length) {
    const { toast } = await import("sonner");
    for (const w of json.blockchainWarnings) {
      toast.warning(`On-chain ${w.operation.replace(/_/g, " ")} failed: ${w.error}`, { duration: 8000 });
    }
  }

  return json;
}
