import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const UpsertUserSchema = z.object({
  address: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  roles: z.array(z.enum(["agency", "client", "investor", "bd"])).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = UpsertUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { address, ...data } = parsed.data;

    if (auth.user!.walletAddress?.toLowerCase() !== address.toLowerCase()) {
      return Response.json({ error: "Forbidden: address mismatch" }, { status: 403 });
    }

    const user = await db.users.upsert(address, data);

    return Response.json(user, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureInit();
    const address = request.nextUrl.searchParams.get("address");

    if (!address) {
      return Response.json(
        { error: "Missing ?address= query parameter" },
        { status: 400 },
      );
    }

    const user = await db.users.findByAddress(address);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
