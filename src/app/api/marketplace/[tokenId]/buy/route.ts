import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getDeployerSigner } from "@/lib/blockchain/clients";
import { buyTokens } from "@/lib/uniswap";
import { requireAuth } from "@/lib/auth";
import { notifyUser } from "@/lib/email";

const BuyBodySchema = z.object({
  amount: z.number().positive(),
  buyerAddress: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { tokenId } = await params;
    const body = await request.json();
    const parsed = BuyBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(tokenId);
    if (!contract) {
      return Response.json(
        { error: "Token/contract not found" },
        { status: 404 },
      );
    }

    if (!contract.tokenAddress) {
      return Response.json(
        { error: "This contract is not tokenized" },
        { status: 400 },
      );
    }

    if (parsed.data.buyerAddress.toLowerCase() !== auth.user!.walletAddress?.toLowerCase()) {
      return Response.json({ error: "Buyer address must match authenticated wallet" }, { status: 403 });
    }

    const { amount, buyerAddress } = parsed.data;

    // Price per token = totalValue / 100 tokens (in USDC, 6 decimals)
    const pricePerToken = contract.totalValue / 100;
    const totalCost = amount * pricePerToken;

    console.log(
      `[marketplace] Buy: ${buyerAddress} purchasing ${amount} tokens of ${tokenId} for $${totalCost} via Uniswap`,
    );

    let txHash: string | undefined;

    // Chain-first: execute Uniswap swap — must succeed or request fails
    if (isBlockchainConfigured() && CHAIN_CONFIG.paymentTokenAddress) {
      try {
        const signer = getDeployerSigner();
        // Convert USDC cost to 6-decimal units
        const usdcAmount = BigInt(Math.round(totalCost * 1e6));
        txHash = await buyTokens({
          tokenAddress: contract.tokenAddress!,
          usdcAddress: CHAIN_CONFIG.paymentTokenAddress,
          usdcAmount,
          signer,
        });
        console.log("[marketplace/buy] On-chain swap success:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "On-chain swap failed";
        console.error("[marketplace/buy] On-chain swap FAILED:", msg);
        return Response.json(
          { error: `Token purchase failed on-chain: ${msg}` },
          { status: 500 },
        );
      }
    }

    // db.holdings not available in current schema — log purchase for now
    console.log("[marketplace/buy] Purchase recorded (DB holdings not yet available):", { buyerAddress, tokenId, amount, pricePerToken });

    // Notify agency of new investment
    if (contract.agency) {
      notifyUser(contract.agency, {
        type: "investment_received",
        contractTitle: contract.title,
        contractId: tokenId,
        tokenAmount: amount,
        amount: totalCost,
        investorName: `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`,
      });
    }

    return Response.json({
      success: true,
      amount,
      pricePerToken,
      totalCost,
      tokenId,
      buyerAddress,
      ...(txHash && { txHash }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
