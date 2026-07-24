import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestHousehold, cleanupAll } from "../helpers/household";

const auth = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getSessionHouseholdId: () => auth.id,
}));

import { POST, GET } from "@/app/api/onboarding/route";
import { db } from "@/lib/db";

describe("POST /api/onboarding", () => {
  beforeEach(async () => {
    const h = await createTestHousehold();
    auth.id = h.id;
  });

  afterEach(async () => {
    await cleanupAll();
    auth.id = null;
  });

  it("creates a preference profile from valid input", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        locations: ["Tel Aviv", "Ramat Gan"],
        budgetMax: 3000000,
        minRooms: 3,
        minSizeSqm: 70,
        mustHaveExtras: ["parking", "mamad"],
        goal: "primary",
        openToRenting: false,
        openToFixerUpper: true,
        renovationBudget: 200000,
        freeText: "quiet street, near a park",
        exampleUrls: ["https://www.yad2.co.il/item/example1"],
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.budgetMax).toBe(3000000);
    const stored = await db.preferenceProfile.findUnique({ where: { id: body.profile.id } });
    expect(JSON.parse(stored!.locations)).toEqual(["Tel Aviv", "Ramat Gan"]);
  });

  it("rejects input missing required fields", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ locations: [] }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("rejects a non-integer budgetMax", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        locations: ["Tel Aviv"],
        budgetMax: 3000000.5,
        goal: "primary",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 with a clean error on malformed JSON body", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: "not valid json",
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  const validPayload = (over: Record<string, unknown> = {}) => ({
    locations: ["Tel Aviv"],
    budgetMax: 3000000,
    goal: "primary",
    mustHaveExtras: [],
    exampleUrls: [],
    ...over,
  });

  it("updates the existing profile instead of creating a second one", async () => {
    const first = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ budgetMax: 3000000 })),
    });
    await POST(first as any);

    const second = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ budgetMax: 4200000 })),
    });
    const res = await POST(second as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.budgetMax).toBe(4200000);
    expect(await db.preferenceProfile.count()).toBe(1);
  });

  it("GET returns the stored profile with parsed array fields", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ locations: ["Tel Aviv", "Ramat Gan"] })),
    });
    await POST(req as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.locations).toEqual(["Tel Aviv", "Ramat Gan"]);
  });

  it("GET returns null when no profile exists", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.profile).toBeNull();
  });

  it("clears optional fields omitted on a re-submit", async () => {
    const withRenovation = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ renovationBudget: 200000, freeText: "near a park" })),
    });
    await POST(withRenovation as any);

    const without = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload()),
    });
    await POST(without as any);

    const res = await GET();
    const body = await res.json();
    expect(body.profile.renovationBudget).toBeNull();
    expect(body.profile.freeText).toBeNull();
  });
});
