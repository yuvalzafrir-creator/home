import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveMemberId } from "@/lib/members";

const schema = z.object({ text: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  const listing = await db.listing.findUnique({ where: { id: params.id } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const note = await db.note.create({
    data: {
      listingId: params.id,
      memberId: getActiveMemberId(),
      text: parsed.data.text,
    },
    include: { member: { select: { name: true } } },
  });

  return NextResponse.json({ note }, { status: 201 });
}
