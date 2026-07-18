import { describe, it, expect, afterEach } from "vitest";
import { GET, POST } from "@/app/api/members/route";
import { db } from "@/lib/db";

function req(body: unknown) {
  return new Request("http://localhost/api/members", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("members API", () => {
  afterEach(async () => {
    await db.member.deleteMany();
  });

  it("creates a member and lists it", async () => {
    const res = await POST(req({ name: "יובל" }));
    expect(res.status).toBe(201);

    const listRes = await GET();
    const body = await listRes.json();
    expect(body.members.map((m: { name: string }) => m.name)).toContain("יובל");
  });

  it("returns 400 on an empty name", async () => {
    const res = await POST(req({ name: "  " }));
    expect(res.status).toBe(400);
  });
});
