import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

// See tests/e2e/onboarding.spec.ts for why this is loaded explicitly and why
// PrismaClient is instantiated directly rather than importing `@/lib/db`.
config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/feed-and-feedback.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). ` +
      "Refusing to run against an unexpected database."
  );
}

const db = new PrismaClient();

// dev.db is the real dev database, not a disposable per-run test DB — it may
// already contain other listings (real or from a previous manual session).
// Rather than asserting on card position (fragile if unrelated listings
// outrank ours by matchScore), identify our seeded listing by its unique
// address and assert *that specific card* disappears after liking it.
test.describe("feed and feedback", () => {
  let listingId: string;
  let address: string;
  // Snapshot of the newest PreferenceProfile's learnedSummary, taken before
  // the Like click. /api/feedback decides whether to refresh the learned
  // summary using a GLOBAL db.feedback.count() (not scoped to this test) and,
  // if it fires, overwrites the newest PreferenceProfile in the ENTIRE table
  // — not one this test owns. This is a full safety net, not conditional on
  // whether we think the trigger will fire: we always snapshot and always
  // restore, so a real dev PreferenceProfile.learnedSummary can never be left
  // corrupted by this test once ANTHROPIC_API_KEY is populated for real.
  let profileBeforeId: string | null;
  let profileBeforeSummary: string | null;

  test.beforeEach(async () => {
    // Real scraping is currently blocked by Yad2's bot detection (Task 12),
    // so there's no reliable way to get a real listing into the feed via the
    // normal app flow. Seed a Listing row directly instead.
    const unique = Date.now();
    address = `E2E Test St ${unique}`;
    const listing = await db.listing.create({
      data: {
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/e2e-${unique}`,
        address,
        price: 2500000,
        rooms: 4,
        sizeSqm: 90,
        matchScore: 90,
        matchReason: "Great match",
      },
    });
    listingId = listing.id;

    const profileBefore = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
    profileBeforeId = profileBefore?.id ?? null;
    profileBeforeSummary = profileBefore?.learnedSummary ?? null;
  });

  test.afterEach(async () => {
    // Clean up feedback first (Feedback.listingId has a FK to Listing) then
    // the listing itself, so repeated runs of this suite don't leave rows
    // behind or trip the every-3rd-feedback learned-summary refresh in
    // /api/feedback with stale counts.
    await db.feedback.deleteMany({ where: { listingId } });
    await db.listing.delete({ where: { id: listingId } });

    // Restore whatever learnedSummary existed on the newest PreferenceProfile
    // before this test ran, regardless of whether the refresh actually
    // fired. See the note above beforeEach for why this is unconditional.
    if (profileBeforeId) {
      await db.preferenceProfile.update({
        where: { id: profileBeforeId },
        data: { learnedSummary: profileBeforeSummary },
      });
    }
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("liking a listing removes it from the feed", async ({ page }) => {
    await page.goto("/");

    const card = page.locator("article").filter({ hasText: address });
    await expect(card).toHaveCount(1);

    // Playwright's getByText does case-insensitive substring matching by
    // default, so a plain getByText("Like") also matches the "Dislike"
    // button. Scope to the exact button role/name instead.
    await card.getByRole("button", { name: "Like", exact: true }).click();

    await expect(page.locator("article").filter({ hasText: address })).toHaveCount(0);
  });
});
