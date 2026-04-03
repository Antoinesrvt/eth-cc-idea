import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { createDeal, isBlockchainConfigured, CHAIN_CONFIG } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

// GET: Look up contract by invite token, return summary with milestones
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await ensureInit();
    const { token } = await params;

    const contract = await db.contracts.findByInviteToken(token);
    if (!contract) {
      return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
    }

    if (contract.status !== "invited") {
      return Response.json(
        { error: "This invite has already been accepted" },
        { status: 400 },
      );
    }

    // Return summary with milestones (no client identity — privacy)
    return Response.json({
      id: contract.id,
      title: contract.title,
      description: contract.description,
      category: contract.category,
      totalValue: contract.totalValue,
      inviteRole: contract.inviteRole,
      creatorRole: contract.creatorRole,
      status: contract.status,
      milestones: contract.milestones.map((m) => ({
        name: m.name,
        description: m.description,
        amount: m.amount,
        deadline: m.deadline,
      })),
    });
  } catch (error) {
    console.error("[invite/GET]", error);
    return Response.json(
      { error: "Failed to load invite details. Please try again." },
      { status: 500 },
    );
  }
}

// POST: Accept the invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await ensureInit();
    const { token } = await params;

    // Get auth — try Privy token first, fall back to body wallet address for hackathon
    const auth = await getAuthUser(request);
    let walletAddress = auth?.walletAddress;

    // If Privy verified the user but no wallet yet, check request body
    if (!walletAddress) {
      try {
        const body = await request.clone().json();
        if (body.walletAddress && typeof body.walletAddress === "string") {
          walletAddress = body.walletAddress;
          console.log("[invite/POST] Using wallet from body:", walletAddress?.slice(0, 10));
        }
      } catch { /* no body or not JSON */ }
    }

    if (!walletAddress) {
      return Response.json(
        { error: "Please connect a wallet first. Sign in with Google or Telegram — a wallet will be created automatically." },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findByInviteToken(token);
    if (!contract) {
      return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
    }

    if (contract.status !== "invited") {
      return Response.json(
        { error: "This invite has already been accepted" },
        { status: 400 },
      );
    }

    // Set the counterparty address and advance status
    const normalizedWallet = walletAddress.toLowerCase();

    if (contract.inviteRole === "client") {
      await db.contracts.update(contract.id, {
        client: normalizedWallet,
        status: "pending_deposit",
      });
    } else {
      await db.contracts.update(contract.id, {
        agency: normalizedWallet,
        status: "pending_deposit",
      });
    }

    await db.users.upsert(normalizedWallet, {
      roles: [contract.inviteRole!],
      email: contract.inviteEmail || undefined,
    });

    console.log("[invite/POST] Accepted:", { contractId: contract.id, wallet: walletAddress.slice(0, 10), role: contract.inviteRole });

    // Notify the other party (usually the agency) that the invite was accepted
    const otherPartyAddress = contract.inviteRole === "client" ? contract.agency : contract.client;
    if (otherPartyAddress) {
      notifyUser(otherPartyAddress, {
        type: "invite_accepted",
        contractTitle: contract.title,
        contractId: contract.id,
        actorName: normalizedWallet.slice(0, 6) + "..." + normalizedWallet.slice(-4),
      });
    }

    // Deploy on-chain now that both parties are known (was skipped at creation because client was empty)
    const updated = await db.contracts.findById(contract.id);
    if (updated && !updated.onChainAddress && isBlockchainConfigured() && CHAIN_CONFIG.factoryAddress && updated.client && updated.agency) {
      try {
        const result = await db.blockchainEvents.tracked(
          { contractId: contract.id, operation: "create_deal", chain: "arbitrum", params: { title: contract.title } },
          async () => {
            const dealResult = await createDeal({
              client: updated.client,
              agency: updated.agency,
              bd: updated.bd,
              bdFeeBps: Math.round((updated.bdFeePercent ?? 0) * 100),
              termsHash: updated.termsHash || `terms_${contract.id}`,
              milestones: updated.milestones.map((m) => ({
                name: m.name,
                amount: BigInt(Math.round(m.amount * 1e18)),
                deadline: m.deadline ? Math.floor(m.deadline.getTime() / 1000) : 0,
              })),
              tokenName: `${updated.title} Token ${updated.id.slice(0, 4)}`,
              tokenSymbol: (updated.title.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3) || "TS") + updated.id.slice(0, 3).toUpperCase(),
            });
            return dealResult;
          },
        );

        if (result) {
          await db.contracts.update(contract.id, {
            onChainAddress: result.serviceContractAddress,
            tokenAddress: result.tokenAddress,
          });
          console.log("[invite/POST] On-chain deploy success:", result.serviceContractAddress);
        }
      } catch (chainErr) {
        console.error("[invite/POST] On-chain deploy failed (continuing DB-only):", chainErr);
      }
    }

    return Response.json({
      contractId: contract.id,
      redirectTo: `/contracts/${contract.id}`,
    });
  } catch (error) {
    console.error("[invite/POST]", error);
    const rawMsg = error instanceof Error ? error.message : "";
    let userMessage = "Failed to accept invite. Please try again.";
    if (rawMsg.includes("duplicate") || rawMsg.includes("unique") || rawMsg.includes("constraint")) {
      userMessage = "This invite may have already been accepted. Please check your contracts.";
    }
    return Response.json(
      { error: userMessage },
      { status: 500 },
    );
  }
}
