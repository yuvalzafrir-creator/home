import { db } from "@/lib/db";

export interface ProfileData {
  id: string;
  locations: string[];
  budgetMax: number;
  minRooms: number | null;
  minSizeSqm: number | null;
  mustHaveExtras: string[];
  goal: string;
  openToRenting: boolean;
  openToFixerUpper: boolean;
  renovationBudget: number | null;
  freeText: string | null;
  exampleUrls: string[];
}

// Single-user tool: there is at most one PreferenceProfile. Return it with the
// JSON-string columns parsed back into arrays, or null if onboarding hasn't run.
export async function getProfile(): Promise<ProfileData | null> {
  const row = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!row) return null;
  return {
    id: row.id,
    locations: JSON.parse(row.locations),
    budgetMax: row.budgetMax,
    minRooms: row.minRooms,
    minSizeSqm: row.minSizeSqm,
    mustHaveExtras: JSON.parse(row.mustHaveExtras),
    goal: row.goal,
    openToRenting: row.openToRenting,
    openToFixerUpper: row.openToFixerUpper,
    renovationBudget: row.renovationBudget,
    freeText: row.freeText,
    exampleUrls: JSON.parse(row.exampleUrls),
  };
}
