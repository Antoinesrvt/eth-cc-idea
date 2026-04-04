"use client";

import { useState, useEffect, useCallback } from "react";

// Global wallet address — set by useAuth, read by all API calls
let _globalWallet: string | null = null;
let _globalToken: string | null = null;

export function setGlobalAuth(wallet: string | null, token: string | null = null) {
  _globalWallet = wallet;
  _globalToken = token;
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

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_globalToken) headers["Authorization"] = `Bearer ${_globalToken}`;
  if (_globalWallet) headers["X-Wallet-Address"] = _globalWallet;
  return headers;
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

export async function postApi<T>(
  url: string,
  body: unknown,
): Promise<T> {
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
