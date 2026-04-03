import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { buyFromMarketplace, isBlockchainConfigured } from "@/lib/blockchain";
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

    // Mock price per token = totalValue / 100 tokens
    const pricePerToken = contract.totalValue / 100;
    const totalCost = amount * pricePerToken;

    console.log(
      `[marketplace] Buy: ${buyerAddress} purchased ${amount} tokens of ${tokenId} for $${totalCost}`,
    );

    let txHash: string | undefined;

    // Attempt real on-chain marketplace purchase if blockchain is configured
    if (isBlockchainConfigured()) {
      const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
      if (marketplaceAddress) {
        const priceWei = BigInt(Math.round(totalCost * 1e18));
        const result = await db.blockchainEvents.tracked(
          { contractId: tokenId, operation: "buy", chain: "arbitrum", params: { amount, totalCost } },
          async () => {
            const txHash = await buyFromMarketplace(marketplaceAddress, 0, priceWei);
            return { txHash };
          },
        );
        if (result) {
          txHash = result.txHash;
        }
      }
    }

    // Record the holding in DB so it shows in the investor's portfolio
    await db.holdings.create(buyerAddress, {
      tokenAddress: contract.tokenAddress!,
      contractId: tokenId,
      amount,
      buyPrice: pricePerToken,
      currentPrice: pricePerToken,
    });

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
