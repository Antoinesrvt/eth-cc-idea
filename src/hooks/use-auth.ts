"use client";

import { useCallback, useEffect, useState } from "react";
import { setGlobalAuth, getGlobalWallet } from "./use-api";

const IS_LOCAL = process.env.NEXT_PUBLIC_ENV === "local";

/**
 * Unified auth hook.
 *
 * Local dev (ENV=local):
 *   Uses window.ethereum (Rabby/MetaMask) to connect directly.
 *   No Privy, no SIWE, no OAuth. Just eth_requestAccounts.
 *
 * Production (ENV=testnet|mainnet):
 *   Uses Privy (Google, Telegram, wallet).
 *   Privy manages session via cookies.
 */
export function useAuth() {
  if (IS_LOCAL) {
    return useLocalAuth();
  }
  return usePrivyAuth();
}

// ── Local: direct wallet connection via window.ethereum ──────────────

function useLocalAuth() {
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = getGlobalWallet();
    if (saved) setAddress(saved);
    setReady(true);
  }, []);

  // Listen for account changes
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { on: (e: string, cb: (accounts: string[]) => void) => void } }).ethereum;
    if (!eth) return;
    const handler = (accounts: string[]) => {
      if (accounts[0]) {
        setAddress(accounts[0]);
        setGlobalAuth(accounts[0]);
      } else {
        setAddress(null);
        setGlobalAuth(null);
      }
    };
    eth.on("accountsChanged", handler);
  }, []);

  const login = useCallback(async () => {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      alert("Install MetaMask or Rabby to connect locally");
      return;
    }
    try {
      // Force the wallet picker / account selector popup
      await eth.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      // After permission granted, get the selected account
      const accounts = await eth.request({ method: "eth_accounts" }) as string[];
      if (accounts[0]) {
        setAddress(accounts[0]);
        setGlobalAuth(accounts[0]);
      }
    } catch {
      console.error("Wallet connection rejected");
    }
  }, []);

  const logout = useCallback(() => {
    setAddress(null);
    setGlobalAuth(null);
  }, []);

  return {
    login,
    logout,
    authenticated: !!address,
    user: null,
    ready,
    walletAddress: address ?? undefined,
    displayName: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
    getAuthToken: async (): Promise<string | null> => null,
  };
}

// ── Production: Privy ────────────────────────────────────────────────

function usePrivyAuth() {
  // Dynamic import to avoid loading Privy in local mode
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePrivy } = require("@privy-io/react-auth");
  const { login, logout, authenticated, user, ready, getAccessToken } = usePrivy();

  const walletAddress = user?.wallet?.address;

  // Sync wallet to global headers
  useEffect(() => {
    if (authenticated && walletAddress) {
      setGlobalAuth(walletAddress);
    }
  }, [authenticated, walletAddress]);

  const displayName =
    user?.email?.address ||
    (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!authenticated) return null;
    try {
      const token = await getAccessToken();
      if (token) setGlobalAuth(walletAddress ?? null, token);
      return token;
    } catch {
      return null;
    }
  }, [authenticated, getAccessToken, walletAddress]);

  return {
    login,
    logout: () => { logout(); setGlobalAuth(null); },
    authenticated,
    user,
    ready,
    walletAddress,
    displayName,
    getAuthToken,
  };
}
