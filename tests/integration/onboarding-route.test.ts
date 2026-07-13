import { describe, it, expect, afterEach } from "vitest";
import { POST, GET } from "@/app/api/onboarding/route";
import { db } from "@/lib/db";

describe("POST /api/onboarding", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
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
});
