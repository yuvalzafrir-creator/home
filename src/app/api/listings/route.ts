import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addListingSchema } from "@/lib/validation";
import { scoreListing } from "@/lib/scoring";
import { geocodeAddress } from "@/lib/geocode";
import { resolveActiveMemberId } from "@/lib/members";
import { getSessionHouseholdId } from "@/lib/auth";

export async function GET(req: Request) {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  const where =
    filter === "favorites"
      ? { householdId, feedback: { some: { reaction: "like" } } }
      : filter === "unseen"
      ? { householdId, feedback: { none: {} } }
      : { householdId };

  const listings = await db.listing.findMany({
    where,
    orderBy: { matchScore: "desc" },
    include: { feedback: true, addedBy: { select: { name: true } } },
  });

  return NextResponse.json({ listings });
}

function deriveSourceSite(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "unknown";
  }
  if (host.includes("yad2")) return "yad2";
  if (host.includes("madlan")) return "madlan";
  return host.replace(/^www\./, "");
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

export async function POST(req: Request) {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const sourceUrl = normalizeUrl(data.url);
  const duplicate = await db.listing.findFirst({ where: { householdId, sourceUrl } });
  if (duplicate) {
    return NextResponse.json({ error: "Listing already exists" }, { status: 409 });
  }

  // Best-effort enrichment — scoring and geocoding must not block creating the
  // listing. Unlike the bulk scraper (src/scraper/run.ts), which skips scoring
  // when no PreferenceProfile exists yet, a manually-submitted listing is a
  // single deliberate action, so we still attempt scoring with a null
  // learnedSummary — scoreListing falls back to "No preferences recorded yet."
  // Scoring (LLM) and geocoding (HTTP) are independent and both non-fatal, so
  // run them in parallel to avoid stacking their worst-case latencies.
  const profile = await db.preferenceProfile.findUnique({ where: { householdId } });
  const listingForScoring = {
    address: data.address,
    price: data.price,
    rooms: data.rooms,
    sizeSqm: data.sizeSqm,
    floor: data.floor ?? null,
    hasParking: data.hasParking,
    hasBalcony: data.hasBalcony,
    hasMamad: data.hasMamad,
    hasElevator: data.hasElevator,
    description: data.description ?? null,
  };

  const [scoreRes, geoRes] = await Promise.allSettled([
    scoreListing(profile ?? { learnedSummary: null }, listingForScoring),
    geocodeAddress(data.address),
  ]);

  let matchScore: number | null = null;
  let matchReason: string | null = null;
  if (scoreRes.status === "fulfilled") {
    matchScore = scoreRes.value.score;
    matchReason = scoreRes.value.reason;
  } else {
    console.warn("POST /api/listings: scoring failed, saving unscored:", scoreRes.reason);
  }
  const geo = geoRes.status === "fulfilled" ? geoRes.value : null;

  try {
    const listing = await db.listing.create({
      data: {
        householdId,
        sourceSite: deriveSourceSite(sourceUrl),
        sourceUrl,
        address: data.address,
        price: data.price,
        rooms: data.rooms,
        sizeSqm: data.sizeSqm,
        floor: data.floor ?? null,
        hasParking: data.hasParking,
        hasBalcony: data.hasBalcony,
        hasMamad: data.hasMamad,
        hasElevator: data.hasElevator,
        description: data.description ?? null,
        matchScore,
        matchReason,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        addedById: await resolveActiveMemberId(householdId),
      },
    });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Listing already exists" }, { status: 409 });
    }
    throw err;
  }
}
