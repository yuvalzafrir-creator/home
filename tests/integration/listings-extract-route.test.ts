import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/claude", () => ({
  askClaude: vi.fn(async () =>
    JSON.stringify({
      address: "בדיקה 1",
      price: 2500000,
      rooms: 3,
      sizeSqm: 80,
      floor: 2,
      hasParking: true,
      hasBalcony: false,
      hasMamad: true,
      hasElevator: false,
      description: null,
    })
  ),
}));

import { POST } from "@/app/api/listings/extract/route";

function req(body: unknown) {
  return new Request("http://localhost/api/listings/extract", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/listings/extract", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns extracted fields on a normal page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>דירה</body></html>", { status: 200 })));
    const res = await POST(req({ url: "https://example.com/listing/1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.fields.address).toBe("בדיקה 1");
  });

  it("reports blocked on a Radware challenge page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>Radware Page verify-message</body></html>", { status: 200 })));
    const res = await POST(req({ url: "https://www.yad2.co.il/item/1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("blocked");
  });

  it("400s on a non-URL body", async () => {
    const res = await POST(req({ url: "not a url" }));
    expect(res.status).toBe(400);
  });

  it("400s on a non-http scheme", async () => {
    const res = await POST(req({ url: "file:///etc/passwd" }));
    expect(res.status).toBe(400);
  });
});
