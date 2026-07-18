import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";
import { getLocalityInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.locations.length === 0) {
    return NextResponse.json({ insights: [] });
  }
  // Cap to keep the response snappy and stay friendly to the open-data API.
  const insights = await getLocalityInsights(profile.locations.slice(0, 6));
  return NextResponse.json({ insights });
}
