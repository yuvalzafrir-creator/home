import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, seedProfile, deleteHousehold } from "./helpers";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/map.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("map page", () => {
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
        sourceUrl: `https://yad2.co.il/item/map-${unique}`,
        address: `Map Test St ${unique}`,
        price: 2500000,
        rooms: 3,
        sizeSqm: 80,
        lat: 32.0853,
        lng: 34.7818,
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

  test("renders a Leaflet map on /map", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator("h1")).toHaveText("מפה");
    // Leaflet adds .leaflet-container to the initialized map div (no tiles needed).
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });
});
