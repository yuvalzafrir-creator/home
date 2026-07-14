import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listingNotesSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = listingNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.listing.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Store trimmed text, or null when blank, so a cleared box doesn't persist "".
  const notes = parsed.data.notes.trim() || null;
  const listing = await db.listing.update({
    where: { id: params.id },
    data: { notes },
  });

  return NextResponse.json({ listing });
}
