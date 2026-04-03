import { ethers } from "ethers";
import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import type { TokenizationExposure } from "@/lib/types/contract";
import { DEFAULT_EXPOSURE } from "@/lib/types/contract";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getProvider } from "@/lib/blockchain/clients";
import { getPoolAddress, getPoolInfo } from "@/lib/uniswap";

// Public endpoint — marketplace listing detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    await ensureInit();
    const { tokenId } = await params;
    const contract = await db.contracts.findById(tokenId);

    if (!contract) {
      return Response.json(
        { error: "Token/contract not found" },
        { status: 404 },
      );
    }

    const escrow = await db.escrows.findByContract(tokenId);
    const disputes = await db.disputes.findByContract(tokenId);

    const agencyProfile = await db.users.findByAddress(contract.agency);

    // Fetch Uniswap V3 pool info for this token (best-effort)
    let poolInfo: {
      poolAddress: string;
      sqrtPriceX96: string;
      tick: number;
      liquidity: string;
    } | null = null;

    if (contract.tokenAddress && CHAIN_CONFIG.paymentTokenAddress) {
      try {
        const provider = getProvider();
        const poolAddress = await getPoolAddress(
          contract.tokenAddress,
          CHAIN_CONFIG.paymentTokenAddress,
          provider,
        );
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          const info = await getPoolInfo(poolAddress, provider);
          if (info) {
            poolInfo = {
              poolAddress,
              // Serialize bigints to strings for JSON
              sqrtPriceX96: info.sqrtPriceX96.toString(),
              tick: info.tick,
              liquidity: info.liquidity.toString(),
            };
          }
        }
      } catch {
        // Pool may not exist yet — best-effort
      }
    }

    const completedMilestones = contract.milestones.filter(
      (m) => m.status === "approved",
    ).length;
    const totalMilestones = contract.milestones.length;
    const progress =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    // Parse exposure settings (agency controls what investors see)
    const exposure: TokenizationExposure = contract.tokenizationExposure
      ? (JSON.parse(contract.tokenizationExposure as string) as TokenizationExposure)
      : DEFAULT_EXPOSURE;

    // Price model: 100 tokens per contract, price = totalValue / 100
    const totalSupply = 100;
    const pricePerToken = contract.totalValue / 100;

    return Response.json({
      id: contract.id,
      title: contract.title,
      category: contract.category,
      totalValue: contract.totalValue,
      status: contract.status,
      tokenAddress: contract.tokenAddress,
      onChainAddress: contract.onChainAddress,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      tokenName: contract.title,
      tokenSymbol: "IDT",
      totalSupply,
      pricePerToken,
      // Uniswap V3 pool data (null if pool not yet created)
      pool: poolInfo,
      exposure: {
        showDescription: exposure.showDescription,
        showMilestones: exposure.showMilestones,
        showDisputeHistory: exposure.showDisputeHistory,
      },
      // Only include description if agency enabled it
      description: exposure.showDescription ? contract.description : undefined,
      // Only include milestones if agency enabled it
      milestones: exposure.showMilestones
        ? contract.milestones.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            amount: m.amount,
            deadline: m.deadline,
            status: m.status,
            deliveredAt: m.deliveredAt,
            approvedAt: m.approvedAt,
          }))
        : undefined,
      progress,
      completedMilestones,
      totalMilestones,
      escrow: escrow
        ? {
            totalAmount: escrow.totalAmount,
            depositedAmount: escrow.depositedAmount,
            released: escrow.releasedAmount ?? 0,
            balance: (escrow.depositedAmount ?? 0) - (escrow.releasedAmount ?? 0),
            status: escrow.status,
          }
        : null,
      // Only include disputes if agency enabled it
      disputes: exposure.showDisputeHistory ? disputes : undefined,
      agency: {
        address: contract.agency,
        name: agencyProfile?.name ?? null,
        score: agencyProfile?.agencyProfile?.score ?? null,
        verified: agencyProfile?.agencyProfile?.verified ?? false,
      },
      // Privacy: client identity never exposed to marketplace
      client: { address: null, name: null },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
