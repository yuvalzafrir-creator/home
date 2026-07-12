import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  const where =
    filter === "favorites"
      ? { feedback: { some: { reaction: "like" } } }
      : filter === "unseen"
      ? { feedback: { none: {} } }
      : {};

  const listings = await db.listing.findMany({
    where,
    orderBy: { matchScore: "desc" },
    include: { feedback: true },
  });

  return NextResponse.json({ listings });
}
