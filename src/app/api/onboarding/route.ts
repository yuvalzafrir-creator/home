import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const profile = await db.preferenceProfile.create({
    data: {
      locations: JSON.stringify(data.locations),
      budgetMax: data.budgetMax,
      minRooms: data.minRooms,
      minSizeSqm: data.minSizeSqm,
      mustHaveExtras: JSON.stringify(data.mustHaveExtras),
      goal: data.goal,
      openToRenting: data.openToRenting,
      openToFixerUpper: data.openToFixerUpper,
      renovationBudget: data.renovationBudget,
      freeText: data.freeText,
      exampleUrls: JSON.stringify(data.exampleUrls),
    },
  });

  return NextResponse.json({ profile });
}
