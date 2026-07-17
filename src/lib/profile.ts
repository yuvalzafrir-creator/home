import { db } from "@/lib/db";
import type { ProfilePatch } from "@/lib/validation";

export interface ProfileData {
  id: string;
  locations: string[];
  budgetMax: number;
  minRooms: number | null;
  minSizeSqm: number | null;
  mustHaveExtras: string[];
  settlementTypes: string[];
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
    settlementTypes: JSON.parse(row.settlementTypes),
    goal: row.goal,
    openToRenting: row.openToRenting,
    openToFixerUpper: row.openToFixerUpper,
    renovationBudget: row.renovationBudget,
    freeText: row.freeText,
    exampleUrls: JSON.parse(row.exampleUrls),
  };
}

// Partial update of the single profile. Only keys present in `patch` are
// written; array fields are re-serialized to JSON strings. Returns the parsed
// updated profile, or null if onboarding hasn't happened yet.
export async function patchProfile(patch: ProfilePatch): Promise<ProfileData | null> {
  const existing = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.locations !== undefined) data.locations = JSON.stringify(patch.locations);
  if (patch.budgetMax !== undefined) data.budgetMax = patch.budgetMax;
  if (patch.minRooms !== undefined) data.minRooms = patch.minRooms;
  if (patch.minSizeSqm !== undefined) data.minSizeSqm = patch.minSizeSqm;
  if (patch.mustHaveExtras !== undefined) data.mustHaveExtras = JSON.stringify(patch.mustHaveExtras);
  if (patch.settlementTypes !== undefined) data.settlementTypes = JSON.stringify(patch.settlementTypes);
  if (patch.goal !== undefined) data.goal = patch.goal;
  if (patch.openToRenting !== undefined) data.openToRenting = patch.openToRenting;
  if (patch.openToFixerUpper !== undefined) data.openToFixerUpper = patch.openToFixerUpper;
  if (patch.renovationBudget !== undefined) data.renovationBudget = patch.renovationBudget;
  if (patch.freeText !== undefined) data.freeText = patch.freeText;

  await db.preferenceProfile.update({ where: { id: existing.id }, data });
  return getProfile();
}
