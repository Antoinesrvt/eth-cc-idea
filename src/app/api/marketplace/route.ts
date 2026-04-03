import { ethers } from "ethers";
import { db, ensureInit } from "@/lib/db";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getProvider } from "@/lib/blockchain/clients";
import { getPoolAddress, getPoolInfo } from "@/lib/uniswap";

// Auth: public (demo) — add requireAuth() for production
export async function GET() {
  try {
    await ensureInit();
    const allContracts = await db.contracts.list();

    const tokenizedContracts = allContracts
      .filter((c) => c.tokenAddress && c.tokenizationExposure);

    const listings = await Promise.all(tokenizedContracts.map(async (contract) => {
        const completedMilestones = contract.milestones.filter(
          (m) => m.status === "approved",
        ).length;
        const totalMilestones = contract.milestones.length;
        const progress =
          totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : 0;

        const completionScore = completedMilestones > 0
          ? Math.round((completedMilestones / Math.max(totalMilestones, 1)) * 100)
          : 0;

        const agencyProfile = await db.users.findByAddress(contract.agency);

        // Fetch Uniswap V3 pool info (best-effort, non-blocking)
        let hasPool = false;
        let poolLiquidity: string | null = null;
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
                hasPool = true;
                poolLiquidity = info.liquidity.toString();
              }
            }
          } catch {
            // Pool may not exist yet
          }
        }

        return {
          tokenId: contract.id,
          tokenAddress: contract.tokenAddress,
          title: contract.title,
          category: contract.category,
          totalValue: contract.totalValue,
          status: contract.status,
          progress,
          completedMilestones,
          totalMilestones,
          avgScore: completionScore,
          // Uniswap pool availability
          hasPool,
          poolLiquidity,
          agency: {
            address: contract.agency,
            name: agencyProfile?.name ?? null,
            score: agencyProfile?.agencyProfile?.score ?? null,
            verified: agencyProfile?.agencyProfile?.verified ?? false,
          },
          createdAt: contract.createdAt,
        };
      }));

    return Response.json(listings);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
