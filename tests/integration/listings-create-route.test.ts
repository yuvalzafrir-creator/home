import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestHousehold, cleanupAll } from "../helpers/household";

vi.mock("@/lib/scoring", () => ({
  scoreListing: vi.fn(async () => ({ score: 77, reason: "בדיקה" })),
}));

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(async () => ({ lat: 32.08, lng: 34.78 })),
}));

const auth = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getSessionHouseholdId: () => auth.id,
}));

import { POST } from "@/app/api/listings/route";
import { db } from "@/lib/db";

const base = {
  url: "https://www.yad2.co.il/item/create-test-1",
  address: "יצירה 1",
  price: 2400000,
  rooms: 3,
  sizeSqm: 75,
  hasParking: true,
};

function req(body: unknown) {
  return new Request("http://localhost/api/listings", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/listings", () => {
  beforeEach(async () => {
    const h = await createTestHousehold();
    auth.id = h.id;
  });

  afterEach(async () => {
    await cleanupAll();
    auth.id = null;
  });

  it("creates a listing, deriving sourceSite and scoring it", async () => {
    const res = await POST(req(base));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.listing.sourceSite).toBe("yad2");
    expect(body.listing.matchScore).toBe(77);
    expect(body.listing.hasParking).toBe(true);
    expect(body.listing.lat).toBe(32.08);
    expect(body.listing.lng).toBe(34.78);
  });

  it("rejects a duplicate sourceUrl with 409", async () => {
    await POST(req(base));
    const res = await POST(req(base));
    expect(res.status).toBe(409);
  });

  it("400s on invalid input", async () => {
    const res = await POST(req({ url: "https://x.com/y", address: "", price: -1 }));
    expect(res.status).toBe(400);
  });

  it("dedups a URL that differs only by a trailing slash", async () => {
    await POST(req(base));
    const res = await POST(req({ ...base, url: base.url + "/" }));
    expect(res.status).toBe(409);
  });
});
