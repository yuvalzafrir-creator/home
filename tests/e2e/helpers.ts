import type { Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

// Sign up a fresh household through the browser's own request context so the
// page carries the resulting session cookie. Every e2e test runs as its own
// isolated household, so tests never see each other's — or the real dev — data,
// and the app's middleware (which redirects unauthenticated requests to /login)
// is satisfied.
export async function signUpHousehold(page: Page, db: PrismaClient): Promise<string> {
  const name = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await page.request.post("/api/auth/signup", {
    data: { name, password: "e2e-password" },
  });
  if (!res.ok()) {
    throw new Error(`signup failed (${res.status()}): ${await res.text()}`);
  }
  const household = await db.household.findUnique({ where: { name } });
  if (!household) throw new Error("household missing after signup");
  return household.id;
}

// Seed the preference profile a household needs to get past the onboarding gate.
export async function seedProfile(db: PrismaClient, householdId: string) {
  return db.preferenceProfile.create({
    data: {
      householdId,
      locations: JSON.stringify(["Tel Aviv"]),
      budgetMax: 3000000,
      mustHaveExtras: JSON.stringify([]),
      goal: "primary",
      exampleUrls: JSON.stringify([]),
    },
  });
}

// Remove a household and everything it owns, children first (FKs are RESTRICT).
export async function deleteHousehold(db: PrismaClient, householdId: string) {
  await db.note.deleteMany({ where: { listing: { householdId } } });
  await db.feedback.deleteMany({ where: { listing: { householdId } } });
  await db.listing.deleteMany({ where: { householdId } });
  await db.member.deleteMany({ where: { householdId } });
  await db.preferenceProfile.deleteMany({ where: { householdId } });
  await db.household.delete({ where: { id: householdId } });
}
