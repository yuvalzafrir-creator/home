import { db } from "@/lib/db";

// A throwaway household for scoped integration tests. Every listing / profile /
// member / note now belongs to a household, so tests create one first and (for
// route tests) point the mocked session at its id.
export async function createTestHousehold(name?: string) {
  return db.household.create({
    data: {
      name: name ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      // Not a real hash — these tests never call verifyPassword.
      passwordHash: "salt:hash",
    },
  });
}

// Wipe every table in dependency order (children before parents) so a household
// can be removed despite the ON DELETE RESTRICT foreign keys, leaving a clean
// slate between tests.
export async function cleanupAll() {
  await db.note.deleteMany();
  await db.feedback.deleteMany();
  await db.listing.deleteMany();
  await db.member.deleteMany();
  await db.preferenceProfile.deleteMany();
  await db.scrapeRun.deleteMany();
  await db.household.deleteMany();
}
