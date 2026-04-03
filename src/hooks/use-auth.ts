"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function useAuth() {
  // When Privy isn't configured, return safe defaults
  if (!PRIVY_CONFIGURED) {
    return {
      login: () => alert("Privy not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local"),
      logout: () => {},
      authenticated: false,
      user: null,
      ready: true,
      walletAddress: undefined as string | undefined,
      displayName: null as string | null,
      getAuthToken: async (): Promise<string | null> => null,
    };
  }

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
