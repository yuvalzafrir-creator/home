import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, seedProfile, deleteHousehold } from "./helpers";

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

// Each test runs as its own household, so the listing and profile it creates
// are fully isolated. That also means /api/feedback's learned-summary refresh
// (now scoped to the household) can only ever touch this household's own
// profile — no snapshot/restore of real dev data is needed anymore.
test.describe("feed and feedback", () => {
  let address: string;
  let householdId: string;

  test.beforeEach(async ({ page }) => {
    householdId = await signUpHousehold(page, db);
    await seedProfile(db, householdId);

    // Real scraping is blocked by Yad2's bot detection, so seed a Listing row
    // directly rather than going through the normal scrape flow.
    const unique = Date.now();
    address = `E2E Test St ${unique}`;
    await db.listing.create({
      data: {
        householdId,
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
  });

  test.afterEach(async () => {
    await deleteHousehold(db, householdId);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("liking a listing marks it as a favorite", async ({ page }) => {
    await page.goto("/listings");

    const card = page.locator("article").filter({ hasText: address });
    await expect(card).toHaveCount(1);

    await card.getByRole("button", { name: "שמור", exact: true }).click();

    // The listings view keeps items after feedback (it's a browsing/history
    // view, not a triage queue). Switch to the favorites filter and confirm
    // the liked listing now appears there.
    await page.selectOption("select#filter", "favorites");
    await expect(page.locator("article").filter({ hasText: address })).toHaveCount(1);
  });
});
