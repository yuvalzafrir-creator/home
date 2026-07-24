import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { signUpHousehold, seedProfile, deleteHousehold } from "./helpers";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/copilot.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("copilot", () => {
  let householdId: string;

  test.beforeEach(async ({ page }) => {
    householdId = await signUpHousehold(page, db);
    // The dashboard ("/") redirects to onboarding without a profile.
    await seedProfile(db, householdId);
  });

  test.afterEach(async () => {
    await deleteHousehold(db, householdId);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("chats and performs a navigate action", async ({ page }) => {
    await page.route("**/api/assistant", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "פתחתי את המפה.", actions: [{ type: "navigate", path: "/map" }] }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "פתיחת העוזר" }).click();
    await page.getByLabel("הודעה לעוזר").fill("תפתח את המפה");
    await page.getByRole("button", { name: "שליחה", exact: true }).click();

    await expect(page.getByText("פתחתי את המפה.")).toBeVisible();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.locator("h1")).toHaveText("מפה");
  });
});
