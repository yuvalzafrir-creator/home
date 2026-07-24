import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, seedProfile, deleteHousehold } from "./helpers";

// See tests/e2e/onboarding.spec.ts for why .env.local is loaded explicitly and
// why PrismaClient is instantiated directly rather than importing "@/lib/db".
config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/listing-detail.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). ` +
      "Refusing to run against an unexpected database."
  );
}

const db = new PrismaClient();

test.describe("listing detail + notes", () => {
  let listingId: string;
  let householdId: string;

  test.beforeEach(async ({ page }) => {
    householdId = await signUpHousehold(page, db);
    await seedProfile(db, householdId);

    const unique = Date.now();
    const listing = await db.listing.create({
      data: {
        householdId,
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/detail-${unique}`,
        address: `Detail Test St ${unique}`,
        price: 2600000,
        rooms: 3,
        sizeSqm: 78,
        floor: 2,
        hasMamad: true,
        matchScore: 88,
        matchReason: "Great fit for your criteria",
      },
    });
    listingId = listing.id;
  });

  test.afterEach(async () => {
    await deleteHousehold(db, householdId);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("shows facts and persists a thread note across reloads", async ({ page }) => {
    await page.goto(`/listings/${listingId}`);

    await expect(page.locator("h1")).toContainText("Detail Test St");
    await expect(page.getByText('78 מ"ר')).toBeVisible();

    const note = `visit Sunday ${Date.now()}`;
    await page.getByLabel("הוספת הערה").fill(note);
    // Wait for the note to actually persist (POST 201) before reloading, so the
    // reload can't race ahead of the write.
    const [notesRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/notes") && r.request().method() === "POST"
      ),
      page.getByRole("button", { name: "הוספת הערה", exact: true }).click(),
    ]);
    expect(notesRes.status()).toBe(201);
    await expect(page.getByText(note)).toBeVisible();

    await page.reload();
    await expect(page.getByText(note)).toBeVisible();
  });
});
