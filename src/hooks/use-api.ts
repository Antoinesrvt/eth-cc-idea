"use client";

import { useState, useEffect, useCallback } from "react";

// Auth is stored in localStorage so it persists across page navigations
// and is available synchronously (no useEffect timing issues)
const WALLET_KEY = "trustsignal_wallet";
const TOKEN_KEY = "trustsignal_token";

export function setGlobalAuth(wallet: string | null, token: string | null = null) {
  if (typeof window === "undefined") return;
  if (wallet) {
    localStorage.setItem(WALLET_KEY, wallet);
  } else {
    localStorage.removeItem(WALLET_KEY);
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getGlobalWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WALLET_KEY);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem(TOKEN_KEY);
  const wallet = localStorage.getItem(WALLET_KEY);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (wallet) headers["X-Wallet-Address"] = wallet;
  return headers;
}

interface UseApiOptions {
  skip?: boolean;
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

    fetch(url, { headers: buildHeaders() })
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

    return () => { cancelled = true; };
  }, [url, options.skip, trigger]);

  return { data, loading, error, refresh };
}

export async function postApi<T>(url: string, body: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers = buildHeaders();
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json;
}
