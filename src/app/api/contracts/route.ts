import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { sendContractInvite } from "@/lib/email";
import { isBlockchainConfigured, createDeal, isFactoryConfigured } from "@/lib/blockchain";
import type { ContractStatus } from "@/lib/types";

const CreateContractSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  counterparty: z.string().min(1, "Counterparty is required"),
  bd: z.string().optional(),
  bdFeePercent: z.number().min(0).max(20).optional(),
  milestones: z
    .array(
      z.object({
        name: z.string().min(1, "Milestone name is required"),
        description: z.string().optional().default(""),
        amount: z.number().positive("Milestone amount must be positive"),
        deadline: z.coerce.date().optional(),
      }),
    )
    .min(1, "At least one milestone is required"),
  termsHash: z.string().optional(),
  termsText: z.string().optional(),
});

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    // Require authentication — agency must have a wallet
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const walletAddress = auth.user!.walletAddress;
    if (!walletAddress) {
      return Response.json(
        { error: "No wallet address found. Please connect a wallet first." },
        { status: 403 },
      );
    }

    // Ensure user exists in DB
    await db.users.upsert(walletAddress, { roles: ["agency"] });

    const body = await request.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.flatten();
      return Response.json(
        { error: "Invalid input", details },
        { status: 400 },
      );
    }

    const { counterparty } = parsed.data;
    const agency = walletAddress.toLowerCase();

    let client: string;
    let inviteToken: string | undefined;
    let inviteEmail: string | undefined;
    let status: ContractStatus;

    // If email: generate invite, client TBD. If address: set client directly.
    if (isEmail(counterparty)) {
      client = "";
      inviteToken = crypto.randomUUID();
      inviteEmail = counterparty;
    } else {
      client = counterparty.toLowerCase();
    }
    status = "draft"; // Always start as draft — simplify the flow

    console.log("[contracts/POST] Creating:", { agency, client: client || inviteEmail, status });

    const contract = await db.contracts.createContract({
      ...parsed.data,
      creatorRole: "agency",
      client,
      agency,
      inviteToken,
      inviteEmail,
      inviteRole: inviteToken ? "client" : undefined,
      status,
    });

    await db.escrows.createEscrow(contract.id, contract.totalValue);

    // Auto-create user records
    if (client) await db.users.upsert(client, { roles: ["client"] });
    await db.users.upsert(agency, { roles: ["agency"] });
    if (contract.bd) await db.users.upsert(contract.bd, { roles: ["bd"] });

    // Auto-create base agency profile if one doesn't exist yet
    try {
      const existingProfile = await db.users.findByAddress(agency);
      if (!existingProfile?.agencyProfile?.companyName) {
        await db.users.updateAgencyScore(agency, {
          companyName: existingProfile?.name || `Agency ${agency.slice(0, 6)}`,
          categories: [parsed.data.category],
        });
        // db.team not available in current schema — skipped
      }
    } catch (profileErr) {
      // Profile creation failed — log but don't block contract creation
      console.warn("[contracts/POST] Agency profile auto-create warning:", profileErr instanceof Error ? profileErr.message : profileErr);
    }

    // Store terms text in DB
    if (parsed.data.termsText) {
      // db.documents not available in current schema — log terms text for now
      console.log("[contracts/POST] Terms text received (storage skipped):", parsed.data.termsText.slice(0, 80));
    }

    // Deploy on-chain via factory if configured AND client is known
    console.log("[contracts/POST] Factory check:", { isFactoryConfigured: isFactoryConfigured(), client, factoryAddr: process.env.CONTRACT_FACTORY_ADDRESS?.slice(0, 10), deployerKey: process.env.DEPLOYER_PRIVATE_KEY ? "set" : "missing" });
    if (isFactoryConfigured() && client) {
      try {
        const result = await createDeal({
          client: contract.client,
          agency: contract.agency,
          bd: contract.bd,
          bdFeeBps: Math.round((contract.bdFeePercent ?? 0) * 100),
          termsHash: contract.termsHash || `terms_${contract.id}`,
          milestones: contract.milestones.map((m) => ({
            name: m.name,
            amount: BigInt(Math.round(m.amount * 1e18)),
            deadline: m.deadline ? Math.floor(m.deadline.getTime() / 1000) : 0,
          })),
          tokenName: `${contract.title} Token`,
          tokenSymbol: (contract.title.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 4) || "DEAL") + contract.id.slice(0, 2).toUpperCase(),
        });

        await db.contracts.update(contract.id, {
          onChainAddress: result.serviceContractAddress,
          tokenAddress: result.tokenAddress,
        });

        console.log("[contracts/POST] On-chain:", result.serviceContractAddress, "token:", result.tokenAddress);
      } catch (chainErr) {
        const chainErrMsg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        console.error("[contracts/POST] Factory deploy FAILED:", chainErrMsg);
        return Response.json(
          { error: `On-chain deployment failed: ${chainErrMsg}` },
          { status: 500 },
        );
      }
    }

    // Send invite email
    let inviteUrl: string | undefined;
    if (inviteToken && inviteEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      inviteUrl = `${appUrl}/contracts/invite/${inviteToken}`;

      const inviterName = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : "An agency";

      await sendContractInvite({
        to: inviteEmail,
        contractTitle: contract.title,
        inviterName,
        inviterRole: "agency",
        inviteUrl,
        totalValue: contract.totalValue,
      }).catch(err => console.error("[contracts/POST] Email send failed:", err));
    }

    // Also generate invite link for wallet-address clients (shareable link)
    if (!inviteUrl && inviteToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      inviteUrl = `${appUrl}/contracts/invite/${inviteToken}`;
    }

    console.log("[contracts/POST] Success:", contract.id);

    return Response.json(
      {
        ...contract,
        inviteUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[contracts/POST] Error:", error);
    // Sanitize error messages — never expose raw DB/blockchain errors to the user
    const rawMsg = error instanceof Error ? error.message : "";
    let userMessage = "Failed to create contract. Please try again.";
    if (rawMsg.includes("duplicate") || rawMsg.includes("unique") || rawMsg.includes("constraint")) {
      userMessage = "A contract with similar details already exists. Please check your existing contracts or try with different parameters.";
    }
    return Response.json(
      { error: userMessage },
      { status: 500 },
    );
  }
}

// Return contracts the caller is party to
export async function GET(request: NextRequest) {
  try {
    await ensureInit();

    // Try auth token first, fall back to ?user= query param
    const auth = await getAuthUser(request);
    const walletAddress =
      auth?.walletAddress ||
      request.nextUrl.searchParams.get("user");

    if (!walletAddress) {
      return Response.json([]);
    }

    const contracts = await db.contracts.findByUser(walletAddress);
    return Response.json(contracts);
  } catch (error) {
    console.error("[contracts/GET] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
