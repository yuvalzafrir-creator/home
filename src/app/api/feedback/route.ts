import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackSchema } from "@/lib/validation";
import { updateLearnedSummary } from "@/lib/preference-profile";

const REFRESH_EVERY_N_FEEDBACK = 3;

export async function POST(req: Request) {
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

  const feedback = await db.feedback.create({
    data: { listingId, reaction, note },
  });

  const totalFeedback = await db.feedback.count();

  if (totalFeedback % REFRESH_EVERY_N_FEEDBACK === 0) {
    const profile = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
    if (profile) {
      try {
        const recent = await db.feedback.findMany({
          orderBy: { createdAt: "desc" },
          take: REFRESH_EVERY_N_FEEDBACK,
          include: { listing: { select: { address: true, floor: true } } },
        });
        const learnedSummary = await updateLearnedSummary(profile, recent as any);
        await db.preferenceProfile.update({ where: { id: profile.id }, data: { learnedSummary } });
      } catch (err) {
        console.error("Failed to refresh learned summary:", err);
      }
    }
  }

  return NextResponse.json({ feedback });
}
