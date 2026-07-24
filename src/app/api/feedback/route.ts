import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackSchema } from "@/lib/validation";
import { updateLearnedSummary } from "@/lib/preference-profile";
import { getSessionHouseholdId } from "@/lib/auth";

const REFRESH_EVERY_N_FEEDBACK = 3;

export async function POST(req: Request) {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { listingId, reaction, note } = parsed.data;

  // Only allow feedback on a listing owned by the signed-in household.
  const listing = await db.listing.findFirst({ where: { id: listingId, householdId } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const feedback = await db.feedback.create({
    data: { listingId, reaction, note },
  });

  const totalFeedback = await db.feedback.count({ where: { listing: { householdId } } });

  if (totalFeedback % REFRESH_EVERY_N_FEEDBACK === 0) {
    const profile = await db.preferenceProfile.findUnique({ where: { householdId } });
    if (profile) {
      try {
        const recent = await db.feedback.findMany({
          where: { listing: { householdId } },
          orderBy: { createdAt: "desc" },
          take: REFRESH_EVERY_N_FEEDBACK,
          include: { listing: { select: { address: true, floor: true } } },
        });
        const learnedSummary = await updateLearnedSummary(profile, recent as never);
        await db.preferenceProfile.update({ where: { householdId }, data: { learnedSummary } });
      } catch (err) {
        console.error("Failed to refresh learned summary:", err);
      }
    }
  }

  return NextResponse.json({ feedback });
}
