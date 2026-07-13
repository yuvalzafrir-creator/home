import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

// Playwright's test runner is a separate Node process from the `next dev`
// server started by playwright.config.ts's webServer — it does NOT
// automatically pick up .env.local the way Next does. Load it explicitly so
// this file's PrismaClient talks to the *same* database
// (prisma/dev.db) that the dev server (and therefore the app under test)
// is using. Using `@/lib/db` here isn't reliable: Playwright's TS transform
// doesn't consistently resolve the Next-only "@/*" tsconfig path alias, so
// we instantiate PrismaClient directly instead.
config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/onboarding.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). ` +
      "Refusing to run against an unexpected database."
  );
}

const db = new PrismaClient();

type ProfileRow = Awaited<ReturnType<typeof db.preferenceProfile.findFirst>>;

test.describe("onboarding", () => {
  let snapshot: NonNullable<ProfileRow>[];

  test.beforeEach(async () => {
    // Snapshot and clear so the onboarding gate lets us reach the form.
    snapshot = await db.preferenceProfile.findMany();
    await db.preferenceProfile.deleteMany();
  });

  test.afterEach(async () => {
    // Remove whatever the test created, then restore the real dev profile(s)
    // exactly as they were (explicit ids + createdAt; updatedAt is @updatedAt).
    await db.preferenceProfile.deleteMany();
    for (const p of snapshot) {
      await db.preferenceProfile.create({
        data: {
          id: p.id,
          locations: p.locations,
          budgetMax: p.budgetMax,
          minRooms: p.minRooms,
          minSizeSqm: p.minSizeSqm,
          mustHaveExtras: p.mustHaveExtras,
          goal: p.goal,
          openToRenting: p.openToRenting,
          openToFixerUpper: p.openToFixerUpper,
          renovationBudget: p.renovationBudget,
          freeText: p.freeText,
          exampleUrls: p.exampleUrls,
          learnedSummary: p.learnedSummary,
          createdAt: p.createdAt,
        },
      });
    }
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
