import { verifyPrivyToken } from "@/lib/payments/privy";
import { db } from "@/lib/db";

export async function getAuthUser(request: Request): Promise<{ userId: string; walletAddress?: string } | null> {
  const authHeader = request.headers.get("authorization");
  const headerWallet = request.headers.get("x-wallet-address");

  if (!authHeader?.startsWith("Bearer ")) {
    // No token but wallet header present — accept for hackathon demo
    if (headerWallet) {
      return { userId: `wallet:${headerWallet}`, walletAddress: headerWallet };
    }
    return null;
  }

  const token = authHeader.slice(7);
  if (!token || token === "null" || token === "undefined") {
    if (headerWallet) {
      return { userId: `wallet:${headerWallet}`, walletAddress: headerWallet };
    }
    return null;
  }

  // verifyPrivyToken now fetches wallet address in one call
  const result = await verifyPrivyToken(token);

  // If Privy verification completely fails, fall back to wallet header
  if (!result) {
    if (headerWallet) {
      console.warn("[auth] Privy verification failed, falling back to X-Wallet-Address header");
      return { userId: `wallet:${headerWallet}`, walletAddress: headerWallet };
    }
    return null;
  }

  // Fallback: check X-Wallet-Address header (sent by frontend)
  if (!result.walletAddress) {
    if (headerWallet) {
      result.walletAddress = headerWallet;
    }
  }

  return result;
}

/** Require authentication. Returns 401 if not authenticated. */
export async function requireAuth(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return { user: null, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null };
}

/** Require a specific role on a contract. Returns 403 if wrong role. */
export async function requireRole(
  request: Request,
  contractId: string,
  role: "client" | "agency" | "party",
): Promise<{ walletAddress: string; error?: undefined } | { error: Response }> {
  const auth = await requireAuth(request);
  if (auth.error) return { error: auth.error };

  const walletAddress = auth.user!.walletAddress;
  if (!walletAddress) {
    return { error: Response.json({ error: "No wallet associated with account" }, { status: 403 }) };
  }

  const contract = await db.contracts.findById(contractId);
  if (!contract) {
    return { error: Response.json({ error: "Contract not found" }, { status: 404 }) };
  }

  const wa = walletAddress.toLowerCase();
  const clientAddr = contract.client?.toLowerCase() || "";
  const agencyAddr = contract.agency?.toLowerCase() || "";

  if (role === "party") {
    if (wa !== clientAddr && wa !== agencyAddr) {
      return { error: Response.json({ error: "Forbidden: not a party to this contract" }, { status: 403 }) };
    }
  } else if (role === "client") {
    if (wa !== clientAddr) {
      return { error: Response.json({ error: "Forbidden: only the client can perform this action" }, { status: 403 }) };
    }
  } else if (role === "agency") {
    if (wa !== agencyAddr) {
      return { error: Response.json({ error: "Forbidden: only the agency can perform this action" }, { status: 403 }) };
    }
  }

  return { walletAddress };
}
