import { describe, it, expect, vi, afterEach } from "vitest";

// Fake Anthropic client: first call asks to updateProfile, second returns text.
const create = vi.fn();
vi.mock("@/lib/claude", () => ({
  getClaudeClient: () => ({ messages: { create } }),
}));

import { POST } from "@/app/api/assistant/route";
import { db } from "@/lib/db";

function req(messages: unknown) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

describe("POST /api/assistant", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
    create.mockReset();
  });

  it("runs a tool-use loop: updateProfile then a final reply", async () => {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 2500000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });

    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "updateProfile", input: { budgetMax: 3000000 } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "עדכנתי את התקציב ל־3,000,000 ₪." }],
      });

    const res = await POST(req([{ role: "user", content: "תעלה את התקציב ל־3 מיליון" }]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reply).toContain("3,000,000");
    const profile = await db.preferenceProfile.findFirst();
    expect(profile!.budgetMax).toBe(3000000);
  });

  it("returns client actions for navigate without executing server-side", async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "n1", name: "navigate", input: { path: "/map" } }],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "פתחתי את המפה." }],
      });

    const res = await POST(req([{ role: "user", content: "תפתח את המפה" }]));
    const body = await res.json();

    expect(body.actions).toEqual([{ type: "navigate", path: "/map" }]);
  });

  it("returns a friendly message when the model call throws", async () => {
    create.mockRejectedValueOnce(new Error("no api key"));
    const res = await POST(req([{ role: "user", content: "hi" }]));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toBeTruthy();
    expect(body.actions).toEqual([]);
  });
});
