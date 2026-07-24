import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveActiveMemberId } from "@/lib/members";
import { getSessionHouseholdId } from "@/lib/auth";

const schema = z.object({ text: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Only allow notes on a listing that belongs to the signed-in household.
  const listing = await db.listing.findFirst({ where: { id: params.id, householdId } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const note = await db.note.create({
    data: {
      listingId: params.id,
      memberId: await resolveActiveMemberId(householdId),
      text: parsed.data.text,
    },
    include: { member: { select: { name: true } } },
  });

  return NextResponse.json({ note }, { status: 201 });
}
