import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestHousehold, cleanupAll } from "../helpers/household";

const auth = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getSessionHouseholdId: () => auth.id,
}));

import { GET, POST } from "@/app/api/members/route";
import { db } from "@/lib/db";

function req(body: unknown) {
  return new Request("http://localhost/api/members", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("members API", () => {
  beforeEach(async () => {
    const h = await createTestHousehold();
    auth.id = h.id;
  });

  afterEach(async () => {
    await cleanupAll();
    auth.id = null;
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
