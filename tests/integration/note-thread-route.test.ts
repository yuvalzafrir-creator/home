import { describe, it, expect, afterEach } from "vitest";
import { POST } from "@/app/api/listings/[id]/notes/route";
import { db } from "@/lib/db";

async function makeListing() {
  return db.listing.create({
    data: {
      sourceSite: "yad2",
      sourceUrl: `https://yad2.co.il/item/note-${Date.now()}-${Math.random()}`,
      address: "Note Thread St 1",
      price: 2000000,
      rooms: 3,
      sizeSqm: 70,
    },
  });
}

function req(id: string, body: unknown) {
  return new Request(`http://localhost/api/listings/${id}/notes`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/listings/[id]/notes", () => {
  afterEach(async () => {
    await db.note.deleteMany();
    await db.listing.deleteMany({ where: { address: "Note Thread St 1" } });
  });

  it("adds a note to a listing", async () => {
    const listing = await makeListing();
    const res = await POST(req(listing.id, { text: "לתאם ביקור ליום ראשון" }), {
      params: { id: listing.id },
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.note.text).toBe("לתאם ביקור ליום ראשון");
    const stored = await db.note.findMany({ where: { listingId: listing.id } });
    expect(stored).toHaveLength(1);
  });

  it("returns 404 for an unknown listing", async () => {
    const res = await POST(req("does-not-exist", { text: "x" }), {
      params: { id: "does-not-exist" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 on empty text", async () => {
    const listing = await makeListing();
    const res = await POST(req(listing.id, { text: "   " }), { params: { id: listing.id } });
    expect(res.status).toBe(400);
  });
});
