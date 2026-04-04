import { ethers } from "ethers";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getDeployerSigner } from "@/lib/blockchain/clients";
import { createPool, addLiquidity } from "@/lib/uniswap";
import { requireAuth } from "@/lib/auth";
import type { TokenizationExposure } from "@/lib/types/contract";
import { DEFAULT_EXPOSURE } from "@/lib/types/contract";

// Minimal ERC20 ABI for ContractToken deployment
const CONTRACT_TOKEN_ABI = [
  "constructor(string memory _name, string memory _symbol, address _owner)",
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
];

const CONTRACT_TOKEN_BYTECODE =
  // We use the pre-compiled bytecode if available; otherwise skip on-chain deploy
  process.env.CONTRACT_TOKEN_BYTECODE || "";

const TokenizeBodySchema = z.object({
  tokenName: z.string().min(1).max(64),
  tokenSymbol: z.string().min(1).max(12),
  totalSupply: z.number().int().positive().default(100),
  pricePerToken: z.number().positive(),
  exposure: z
    .object({
      showDescription: z.boolean().optional(),
      showMilestones: z.boolean().optional(),
      showDisputeHistory: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/contracts/:id/tokenize
 *
 * Agency-only. Marks a contract as tokenized, then best-effort:
 *  1. Deploys ContractToken (ERC20) if bytecode is available
 *  2. Creates a Uniswap V3 pool (ContractToken / USDC)
 *  3. Adds initial liquidity to the pool
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureInit();
    const { id } = await params;
    const contract = await db.contracts.findById(id);

    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    // Only agency can tokenize
    if (contract.agency.toLowerCase() !== auth.user!.walletAddress?.toLowerCase()) {
      return Response.json({ error: "Only the agency can tokenize this contract" }, { status: 403 });
    }

    // Contract must be active (escrow deposited)
    if (contract.status !== "active") {
      return Response.json(
        { error: "Contract must be active (escrow deposited) before tokenization" },
        { status: 400 },
      );
    }

    // Already tokenized?
    if (contract.tokenizationExposure) {
      return Response.json({ error: "Contract is already tokenized" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = TokenizeBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tokenName, tokenSymbol, totalSupply, pricePerToken, exposure } = parsed.data;

    const exposureSettings: TokenizationExposure = {
      ...DEFAULT_EXPOSURE,
      ...exposure,
    };

    let tokenAddress: string | undefined = contract.tokenAddress ?? undefined;
    let poolAddress: string | undefined;

    // ── On-chain: deploy ContractToken + create Uniswap pool ─────────────────
    if (isBlockchainConfigured() && CHAIN_CONFIG.paymentTokenAddress) {
      try {
        const signer = getDeployerSigner();
        const agencyAddress = await signer.getAddress();

        // 1. Deploy ContractToken if no existing token
        if (!tokenAddress) {
          // Use ContractToken bytecode from compiled artifacts or inline deployment
          const tokenFactory = new ethers.ContractFactory(
            [
              "constructor(string memory _name, string memory _symbol, address _owner)",
              "function mint(address to, uint256 amount) external",
              "function approve(address spender, uint256 amount) external returns (bool)",
              "function balanceOf(address owner) external view returns (uint256)",
            ],
            CONTRACT_TOKEN_BYTECODE || "0x", // Will fail gracefully if no bytecode
            signer,
          );

          if (CONTRACT_TOKEN_BYTECODE) {
            const token = await tokenFactory.deploy(tokenName, tokenSymbol, agencyAddress, { gasLimit: 3_000_000 });
            await token.waitForDeployment();
            tokenAddress = await token.getAddress();
            console.log(`[tokenize] ContractToken deployed: ${tokenAddress}`);

            const tokenContract = new ethers.Contract(tokenAddress, CONTRACT_TOKEN_ABI, signer);
            const mintAmount = ethers.parseUnits(totalSupply.toString(), 18);
            await (await tokenContract.mint(agencyAddress, mintAmount)).wait(1);
            console.log(`[tokenize] Minted ${totalSupply} tokens`);
          } else {
            // No bytecode — create a placeholder token address for DB tracking
            tokenAddress = `0xtoken_${id.slice(0, 8)}`;
            console.log(`[tokenize] No bytecode — using placeholder token: ${tokenAddress}`);
          }
        }

        if (tokenAddress) {
          // 2. Create Uniswap V3 pool (ContractToken / USDC)
          try {
            poolAddress = await createPool({
              tokenAddress,
              usdcAddress: CHAIN_CONFIG.paymentTokenAddress,
              initialPrice: pricePerToken, // USDC per token
              signer,
            });
            console.log(`[tokenize] Uniswap pool created: ${poolAddress}`);
          } catch (poolErr) {
            console.warn("[tokenize] Pool creation failed (best-effort):", poolErr instanceof Error ? poolErr.message : poolErr);
          }

          // 3. Add initial liquidity if pool was created
          if (poolAddress && poolAddress !== ethers.ZeroAddress) {
            try {
              // Provide liquidity: all minted tokens + equivalent USDC
              const tokenAmount = ethers.parseUnits(totalSupply.toString(), 18);
              // USDC = totalSupply * pricePerToken (6 decimals)
              const usdcAmount = BigInt(Math.round(totalSupply * pricePerToken * 1e6));

              await addLiquidity({
                tokenAddress,
                usdcAddress: CHAIN_CONFIG.paymentTokenAddress,
                tokenAmount,
                usdcAmount,
                signer,
              });
              console.log(`[tokenize] Initial liquidity added to pool`);
            } catch (liqErr) {
              console.warn("[tokenize] Add liquidity failed (best-effort):", liqErr instanceof Error ? liqErr.message : liqErr);
            }
          }
        }
      } catch (chainErr) {
        console.warn("[tokenize] On-chain deployment failed (continuing DB-only):", chainErr);
      }
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const updated = await db.contracts.update(id, {
      ...(tokenAddress && { tokenAddress }),
      tokenizationExposure: JSON.stringify(exposureSettings),
    });

    return Response.json({
      success: true,
      contract: updated,
      tokenAddress: updated.tokenAddress,
      poolAddress: poolAddress ?? null,
    });
  } catch (error) {
    console.error("[tokenize] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
