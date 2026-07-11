import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("prisma schema", () => {
  it("can create and read a PreferenceProfile", async () => {
    const db = new PrismaClient();
    const profile = await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });
    const found = await db.preferenceProfile.findUnique({ where: { id: profile.id } });
    expect(found?.budgetMax).toBe(3000000);
    await db.preferenceProfile.delete({ where: { id: profile.id } });
    await db.$disconnect();
  });
});
