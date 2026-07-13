import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";
import { getProfile } from "@/lib/profile";

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const fields = {
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
  };

  // Single-user tool: update the existing profile if present, else create.
  const existing = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  const profile = existing
    ? await db.preferenceProfile.update({ where: { id: existing.id }, data: fields })
    : await db.preferenceProfile.create({ data: fields });

  return NextResponse.json({ profile });
}
