import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth, getAuthUser } from "@/lib/auth";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "invited", "pending_deposit", "active", "completed", "disputed", "cancelled", "failed"]).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;
    const contract = await db.contracts.findById(id);

    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    // Auth check: only contract parties can view full details
    const user = await getAuthUser(request);
    const walletAddress = user?.walletAddress?.toLowerCase();
    const clientAddr = contract.client?.toLowerCase();
    const agencyAddr = contract.agency?.toLowerCase();
    const isClient = !!walletAddress && walletAddress === clientAddr;
    const isAgency = !!walletAddress && walletAddress === agencyAddr;
    const isParty = isClient || isAgency;

    if (!isParty && walletAddress) {
      console.log("[contract/GET] Access denied:", { wallet: walletAddress.slice(0, 10), client: clientAddr?.slice(0, 10), agency: agencyAddr?.slice(0, 10) });
    }

    // If tokenized, allow public read with filtered data (no client info)
    if (!isParty && contract.tokenAddress && contract.tokenizationExposure) {
      const exposure = JSON.parse(contract.tokenizationExposure) as {
        showDescription: boolean;
        showMilestones: boolean;
        showDisputeHistory: boolean;
      };

      const escrow = await db.escrows.findByContract(id);

      return Response.json({
        id: contract.id,
        title: contract.title,
        description: exposure.showDescription ? contract.description : undefined,
        category: contract.category,
        totalValue: contract.totalValue,
        status: contract.status,
        agency: contract.agency,
        client: "[Private]",
        milestones: exposure.showMilestones
          ? contract.milestones.map((m) => ({
              id: m.id,
              name: m.name,
              amount: m.amount,
              status: m.status,
            }))
          : undefined,
        tokenAddress: contract.tokenAddress,
        escrow: escrow ? { totalAmount: escrow.totalAmount, depositedAmount: escrow.depositedAmount, releasedAmount: escrow.releasedAmount, status: escrow.status } : undefined,
        createdAt: contract.createdAt,
      });
    }

    // If the contract is still awaiting invite acceptance, return a helpful error
    if (!isParty && contract.status === "invited" && contract.inviteToken) {
      return Response.json(
        { error: "This contract requires an invitation to join", code: "INVITE_REQUIRED", inviteRole: contract.inviteRole },
        { status: 403 },
      );
    }

    // Not a party and not a tokenized public view → require auth
    if (!isParty) {
      return Response.json({ error: "Forbidden: not a party to this contract" }, { status: 403 });
    }

    const escrow = await db.escrows.findByContract(id);
    const disputes = await db.disputes.findByContract(id);
    const blockchainEvents = await db.blockchainEvents.findByContract(id);

    return Response.json({ ...contract, escrow, disputes, blockchainEvents });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await db.contracts.findById(id);
    if (!existing) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    // Only contract parties can update
    const walletAddress = auth.user!.walletAddress;
    if (walletAddress?.toLowerCase() !== existing.client?.toLowerCase() && walletAddress?.toLowerCase() !== existing.agency?.toLowerCase()) {
      return Response.json({ error: "Forbidden: not a party to this contract" }, { status: 403 });
    }

    const updated = await db.contracts.update(id, parsed.data);
    return Response.json(updated);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
