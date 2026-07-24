import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestHousehold, cleanupAll } from "../helpers/household";

const auth = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getSessionHouseholdId: () => auth.id,
}));

import { POST } from "@/app/api/feedback/route";
import { db } from "@/lib/db";
import * as prefProfile from "@/lib/preference-profile";

describe("POST /api/feedback", () => {
  let listingId: string;
  let profileId: string;

  beforeEach(async () => {
    const h = await createTestHousehold();
    auth.id = h.id;

    const listing = await db.listing.create({
      data: {
        householdId: h.id,
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/${Date.now()}`,
        address: "Test St 1",
        price: 1000000,
        rooms: 3,
        sizeSqm: 60,
      },
    });
    listingId = listing.id;

    const profile = await db.preferenceProfile.create({
      data: {
        householdId: h.id,
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });
    profileId = profile.id;
  });

  afterEach(async () => {
    await cleanupAll();
    auth.id = null;
  });

  it("stores feedback for a listing", async () => {
    vi.spyOn(prefProfile, "updateLearnedSummary").mockResolvedValue("updated summary");

    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ listingId, reaction: "like", note: "great layout" }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const stored = await db.feedback.findFirst({ where: { listingId } });
    expect(stored?.reaction).toBe("like");
    expect(stored?.note).toBe("great layout");
  });

  it("triggers a learned-summary update every 3rd feedback event", async () => {
    const spy = vi.spyOn(prefProfile, "updateLearnedSummary").mockResolvedValue("updated summary");

    for (let i = 0; i < 3; i++) {
      const req = new Request("http://localhost/api/feedback", {
        method: "POST",
        body: JSON.stringify({ listingId, reaction: "like" }),
      });
      await POST(req as any);
    }

    expect(spy).toHaveBeenCalledTimes(1);
    const profile = await db.preferenceProfile.findUnique({ where: { id: profileId } });
    expect(profile?.learnedSummary).toBe("updated summary");
  });

  it("does not fail the feedback submission if the learned-summary refresh throws", async () => {
    vi.spyOn(prefProfile, "updateLearnedSummary").mockRejectedValue(new Error("Claude API down"));

    for (let i = 0; i < 3; i++) {
      const req = new Request("http://localhost/api/feedback", {
        method: "POST",
        body: JSON.stringify({ listingId, reaction: "like" }),
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
    }

    const feedbackCount = await db.feedback.count();
    expect(feedbackCount).toBe(3);

    const profile = await db.preferenceProfile.findUnique({ where: { id: profileId } });
    expect(profile?.learnedSummary).toBeNull();
  });
});
