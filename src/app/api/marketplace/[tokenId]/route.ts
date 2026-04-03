import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import type { TokenizationExposure } from "@/lib/types/contract";
import { DEFAULT_EXPOSURE } from "@/lib/types/contract";
import { getDb } from "@/lib/db/client";
import { eq } from "drizzle-orm";

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

    // Fetch listing metadata (token name, symbol, supply, price)
    const listing = contract.tokenAddress
      ? (await getDb()
          .select()
      : null;

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

    // Hackathon price model: 100 tokens per contract, price = totalValue / 100
    const totalSupply = listing?.totalSupply ?? 100;
    const pricePerToken = listing?.price ?? contract.totalValue / 100;

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
      tokenName: listing?.tokenName ?? contract.title,
      tokenSymbol: listing?.tokenSymbol ?? "IDT",
      totalSupply,
      pricePerToken,
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
