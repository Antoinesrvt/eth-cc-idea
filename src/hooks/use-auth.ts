"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useState, useEffect } from "react";
import { setGlobalAuth, getGlobalWallet } from "./use-api";

const IS_LOCAL = process.env.NEXT_PUBLIC_ENV === "local";
const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID && !IS_LOCAL;

// Anvil default accounts for local dev
const ANVIL_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", label: "Agency (Account #0)" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", label: "Client (Account #1)" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", label: "Investor (Account #2)" },
];

export function useAuth() {
  // ── Local dev mode: pick an Anvil account, no Privy ──
  if (IS_LOCAL) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [accountIndex, setAccountIndex] = useState(0);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [loggedIn, setLoggedIn] = useState(false);

    const account = ANVIL_ACCOUNTS[accountIndex];

    const login = () => {
      const choice = window.prompt(
        `Select Anvil account:\n0 — Agency (${ANVIL_ACCOUNTS[0].address.slice(0, 8)}...)\n1 — Client (${ANVIL_ACCOUNTS[1].address.slice(0, 8)}...)\n2 — Investor (${ANVIL_ACCOUNTS[2].address.slice(0, 8)}...)\n\nEnter 0, 1, or 2:`,
        "0",
      );
      const idx = parseInt(choice || "0");
      if (idx >= 0 && idx < ANVIL_ACCOUNTS.length) {
        setAccountIndex(idx);
        // Set auth SYNCHRONOUSLY before any renders/fetches
        setGlobalAuth(ANVIL_ACCOUNTS[idx].address);
      } else {
        setGlobalAuth(account.address);
      }
      setLoggedIn(true);
    };

    // On mount: restore from localStorage if previously logged in
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const saved = getGlobalWallet();
      if (saved) {
        const idx = ANVIL_ACCOUNTS.findIndex(a => a.address.toLowerCase() === saved.toLowerCase());
        if (idx >= 0) {
          setAccountIndex(idx);
          setLoggedIn(true);
        }
      }
    }, []);

    return {
      login,
      logout: () => { setLoggedIn(false); setGlobalAuth(null); window.location.reload(); },
      authenticated: loggedIn,
      user: null,
      ready: true,
      walletAddress: loggedIn ? account.address : undefined,
      displayName: loggedIn ? account.label : null,
      getAuthToken: async (): Promise<string | null> => null,
    };
  }

  // ── Privy not configured ──
  if (!PRIVY_CONFIGURED) {
    return {
      login: () => alert("Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local, or use ENV=local for Anvil accounts"),
      logout: () => {},
      authenticated: false,
      user: null,
      ready: true,
      walletAddress: undefined as string | undefined,
      displayName: null as string | null,
      getAuthToken: async (): Promise<string | null> => null,
    };
  }

  // ── Production: Privy ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { login, logout, authenticated, user, ready, getAccessToken } = usePrivy();

  const walletAddress = user?.wallet?.address;
  const displayName =
    user?.email?.address ||
    (walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!authenticated) return null;
    try {
      return await getAccessToken();
    } catch {
      return null;
    }
  }, [authenticated, getAccessToken]);

  return {
    login,
    logout,
    authenticated,
    user,
    ready,
    walletAddress,
    displayName,
    getAuthToken,
  };
}
