import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/scoring", () => ({
  scoreListing: vi.fn(async () => ({ score: 77, reason: "בדיקה" })),
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
  afterEach(async () => {
    await db.listing.deleteMany({ where: { address: "יצירה 1" } });
  });

  it("creates a listing, deriving sourceSite and scoring it", async () => {
    const res = await POST(req(base));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.listing.sourceSite).toBe("yad2");
    expect(body.listing.matchScore).toBe(77);
    expect(body.listing.hasParking).toBe(true);
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
});
