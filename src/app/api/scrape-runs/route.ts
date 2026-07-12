import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const lastRun = await db.scrapeRun.findFirst({ orderBy: { startedAt: "desc" } });
  return NextResponse.json({ lastRun });
}
