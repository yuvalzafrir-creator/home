import { describe, it, expect, afterEach } from "vitest";
import { PATCH } from "@/app/api/listings/[id]/route";
import { db } from "@/lib/db";

async function makeListing() {
  return db.listing.create({
    data: {
      sourceSite: "yad2",
      sourceUrl: `https://yad2.co.il/item/notes-${Date.now()}-${Math.random()}`,
      address: "Notes Test St 1",
      price: 2000000,
      rooms: 3,
      sizeSqm: 70,
    },
  });
}

function patchReq(id: string, body: unknown) {
  return new Request(`http://localhost/api/listings/${id}`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("PATCH /api/listings/[id]", () => {
  afterEach(async () => {
    await db.listing.deleteMany({ where: { address: "Notes Test St 1" } });
  });

  it("saves notes on a listing", async () => {
    const listing = await makeListing();
    const res = await PATCH(patchReq(listing.id, { notes: "call the agent Sunday" }), {
      params: { id: listing.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.listing.notes).toBe("call the agent Sunday");
    const stored = await db.listing.findUnique({ where: { id: listing.id } });
    expect(stored!.notes).toBe("call the agent Sunday");
  });

  it("clears notes to null when given blank text", async () => {
    const listing = await makeListing();
    await PATCH(patchReq(listing.id, { notes: "temp" }), { params: { id: listing.id } });
    await PATCH(patchReq(listing.id, { notes: "   " }), { params: { id: listing.id } });

    const stored = await db.listing.findUnique({ where: { id: listing.id } });
    expect(stored!.notes).toBeNull();
  });

  it("returns 404 for an unknown listing", async () => {
    const res = await PATCH(patchReq("does-not-exist", { notes: "x" }), {
      params: { id: "does-not-exist" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed body", async () => {
    const listing = await makeListing();
    const res = await PATCH(patchReq(listing.id, "not json"), { params: { id: listing.id } });
    expect(res.status).toBe(400);
  });
});
