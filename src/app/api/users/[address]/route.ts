import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const UpdateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  roles: z.array(z.enum(["agency", "client", "investor", "bd"])).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const { address } = await params;
    // Auto-create user on first visit (so profile page works before first contract)
    let user = await db.users.findByAddress(address);
    if (!user) {
      user = await db.users.upsert(address, { roles: [] });
    }

    const contractsAsClient = (await db.contracts.findByUser(address)).filter(
      (c) => c.client === address,
    );
    const contractsAsAgency = (await db.contracts.findByUser(address)).filter(
      (c) => c.agency === address,
    );

    return Response.json({
      ...user,
      contractsAsClient,
      contractsAsAgency,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { address } = await params;

    const authWallet = auth.user!.walletAddress;
    if (!authWallet || authWallet.toLowerCase() !== address.toLowerCase()) {
      return Response.json(
        { error: "Forbidden: address mismatch", debug: { authWallet: authWallet?.slice(0, 10), address: address.slice(0, 10) } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await db.users.findByAddress(address);
    if (!existing) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await db.users.upsert(address, parsed.data);
    return Response.json(updated);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
