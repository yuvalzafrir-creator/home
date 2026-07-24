import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, seedProfile, deleteHousehold } from "./helpers";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/add-listing.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("add listing by URL", () => {
  const sourceUrl = `https://www.yad2.co.il/item/e2e-add-${Date.now()}`;
  const address = `Add Test St ${Date.now()}`;
  let householdId: string;

  test.beforeEach(async ({ page }) => {
    householdId = await signUpHousehold(page, db);
    await seedProfile(db, householdId);
  });

  test.afterEach(async () => {
    await deleteHousehold(db, householdId);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("manually add a listing and land on its detail page", async ({ page }) => {
    await page.goto("/add");

    await page.fill('input[name="url"]', sourceUrl);
    await page.getByLabel("כתובת").fill(address);
    await page.getByLabel("מחיר (₪)").fill("2450000");
    await page.getByLabel("חדרים").fill("3");
    await page.getByLabel('שטח (מ"ר)').fill("72");

    await page.getByRole("button", { name: "הוספת מודעה", exact: true }).click();

    // Creating a listing scores it via a real Claude call (~several seconds),
    // so allow generous time for the resulting redirect to the detail page.
    await expect(page).toHaveURL(/\/listings\/[a-z0-9]+$/, { timeout: 20000 });
    await expect(page.locator("h1")).toContainText(address);
  });
});
