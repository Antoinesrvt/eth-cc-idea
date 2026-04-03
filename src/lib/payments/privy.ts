import { PrivyClient } from "@privy-io/server-auth";
import { PAYMENTS_CONFIG } from "./config";

let _privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    if (!PAYMENTS_CONFIG.privy.appId || !PAYMENTS_CONFIG.privy.appSecret) {
      throw new Error("[privy] NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
    }
    _privyClient = new PrivyClient(
      PAYMENTS_CONFIG.privy.appId,
      PAYMENTS_CONFIG.privy.appSecret,
    );
  }
  return _privyClient;
}

/** Verify a Privy auth token. Returns user ID + wallet address. */
export async function verifyPrivyToken(authToken: string): Promise<{
  userId: string;
  walletAddress?: string;
} | null> {
  try {
    const client = getPrivyClient();
    const verifiedClaims = await client.verifyAuthToken(authToken);

    // Fetch the full user to get wallet address (not in JWT claims)
    let walletAddress: string | undefined;
    try {
      const user = await client.getUser(verifiedClaims.userId);

      // Check embedded wallet first (created by Privy for users without wallets)
      const embedded = user.linkedAccounts?.find(
        (a: { type: string; walletClientType?: string }) =>
          a.type === "wallet" && a.walletClientType === "privy",
      ) as { address?: string } | undefined;

      if (embedded?.address) {
        walletAddress = embedded.address;
      } else if (user.wallet?.address) {
        walletAddress = user.wallet.address;
      }
    } catch (walletErr) {
      console.warn("[privy] Failed to fetch wallet for user:", verifiedClaims.userId, walletErr);
    }

    return { userId: verifiedClaims.userId, walletAddress };
  } catch (err) {
    console.error("[privy] Token verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Get user's linked wallet address from Privy API. */
export async function getUserWallet(privyUserId: string): Promise<string | null> {
  try {
    const client = getPrivyClient();
    const user = await client.getUser(privyUserId);

    // Check embedded wallet first, then linked wallets
    const embedded = user.linkedAccounts?.find(
      (a: any) => a.type === "wallet" && a.walletClientType === "privy",
    ) as any;
    if (embedded?.address) {
      console.log("[privy] Found embedded wallet:", embedded.address.slice(0, 10) + "...");
      return embedded.address;
    }

    const wallet = user.wallet;
    if (wallet?.address) {
      console.log("[privy] Found wallet:", wallet.address.slice(0, 10) + "...");
      return wallet.address;
    }

    console.warn("[privy] No wallet found for user:", privyUserId);
    return null;
  } catch (err) {
    console.error("[privy] getUserWallet failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
