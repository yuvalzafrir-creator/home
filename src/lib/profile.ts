import { db } from "@/lib/db";
import type { ProfilePatch } from "@/lib/validation";
import { getSessionHouseholdId } from "@/lib/auth";

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

// The signed-in household's preference profile (one per household), with the
// JSON-string columns parsed back into arrays. null if not signed in or the
// household hasn't onboarded yet.
export async function getProfile(): Promise<ProfileData | null> {
  const householdId = getSessionHouseholdId();
  if (!householdId) return null;
  const row = await db.preferenceProfile.findUnique({ where: { householdId } });
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

// Partial update of the signed-in household's profile. null if not signed in or
// no profile yet.
export async function patchProfile(patch: ProfilePatch): Promise<ProfileData | null> {
  const householdId = getSessionHouseholdId();
  if (!householdId) return null;
  const existing = await db.preferenceProfile.findUnique({ where: { householdId } });
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

  await db.preferenceProfile.update({ where: { householdId }, data });
  return getProfile();
}
