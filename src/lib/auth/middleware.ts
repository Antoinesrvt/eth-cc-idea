import { verifyPrivyToken } from "@/lib/payments/privy";
import { db } from "@/lib/db";

/**
 * Authenticate the caller via Privy token.
 *
 * In development only (NODE_ENV=development OR ALLOW_HEADER_AUTH=true),
 * X-Wallet-Address header is accepted as a fallback when no valid token
 * is provided. In production this header is ignored entirely.
 */
export async function getAuthUser(request: Request): Promise<{ userId: string; walletAddress?: string } | null> {
  const authHeader = request.headers.get("authorization");

  const allowHeaderAuth =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_HEADER_AUTH === "true";

  const headerWallet = allowHeaderAuth
    ? request.headers.get("x-wallet-address")
    : null;

  if (!authHeader?.startsWith("Bearer ")) {
    // No token — accept header wallet only in dev mode
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

  // Verify Privy token (also fetches wallet address)
  const result = await verifyPrivyToken(token);

  if (!result) {
    // Privy verification failed — do NOT fall back to header in production
    if (headerWallet) {
      console.warn("[auth] Privy verification failed, falling back to X-Wallet-Address header (dev only)");
      return { userId: `wallet:${headerWallet}`, walletAddress: headerWallet };
    }
    return null;
  }

  // If Privy returned a user but no wallet, return 401-equivalent (null)
  // rather than trusting a client-supplied header
  if (!result.walletAddress) {
    return result;
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
