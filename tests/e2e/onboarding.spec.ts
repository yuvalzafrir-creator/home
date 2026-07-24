import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, deleteHousehold } from "./helpers";

// Playwright's test runner is a separate Node process from the `next dev`
// server started by playwright.config.ts's webServer — it does NOT
// automatically pick up .env.local the way Next does. Load it explicitly so
// this file's PrismaClient talks to the *same* database (prisma/dev.db) that
// the dev server (and therefore the app under test) is using. Using
// `@/lib/db` here isn't reliable: Playwright's TS transform doesn't
// consistently resolve the Next-only "@/*" tsconfig path alias, so we
// instantiate PrismaClient directly instead.
config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/onboarding.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). ` +
      "Refusing to run against an unexpected database."
  );
}

const db = new PrismaClient();

test.describe("onboarding", () => {
  let householdId: string;

  test.beforeEach(async ({ page }) => {
    // A fresh household has no profile yet, so the onboarding gate lets us
    // reach the form — no snapshot/restore of other households needed.
    householdId = await signUpHousehold(page, db);
  });

  test.afterEach(async () => {
    await deleteHousehold(db, householdId);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("user can complete onboarding and land on the dashboard", async ({ page }) => {
    await page.goto("/onboarding");

    await page.fill('input[name="locations"]', "Tel Aviv, Ramat Gan");
    await page.fill('input[name="budgetMax"]', "3000000");
    await page.selectOption('select[name="goal"]', "primary");
    await page.fill('textarea[name="freeText"]', "quiet street, near a park");

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toHaveText("לוח בקרה");
  });
});
