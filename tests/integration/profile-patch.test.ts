import { describe, it, expect, afterEach } from "vitest";
import { patchProfile } from "@/lib/profile";
import { db } from "@/lib/db";

async function seedProfile() {
  return db.preferenceProfile.create({
    data: {
      locations: JSON.stringify(["Tel Aviv"]),
      budgetMax: 2500000,
      mustHaveExtras: JSON.stringify(["mamad"]),
      goal: "primary",
      exampleUrls: JSON.stringify([]),
    },
  });
}

describe("patchProfile", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
  });

  it("updates only the provided fields and parses arrays back", async () => {
    await seedProfile();
    const updated = await patchProfile({ budgetMax: 3200000, mustHaveExtras: ["mamad", "parking"] });
    expect(updated).not.toBeNull();
    expect(updated!.budgetMax).toBe(3200000);
    expect(updated!.mustHaveExtras).toEqual(["mamad", "parking"]);
    expect(updated!.locations).toEqual(["Tel Aviv"]);
  });

  it("returns null when no profile exists", async () => {
    expect(await patchProfile({ budgetMax: 1 })).toBeNull();
  });
});
