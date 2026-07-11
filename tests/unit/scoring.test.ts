import { describe, it, expect, vi } from "vitest";
import { scoreListing } from "@/lib/scoring";
import * as claude from "@/lib/claude";

describe("scoreListing", () => {
  it("parses a score and reason out of Claude's response", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue(
      JSON.stringify({ score: 87, reason: "Matches budget and has a mamad, but slightly small." })
    );

    const result = await scoreListing(
      { learnedSummary: "Wants 3-4 rooms in Tel Aviv under 3M, must have a mamad." } as any,
      {
        address: "Rothschild 12, Tel Aviv",
        price: 2450000,
        rooms: 4,
        sizeSqm: 95,
        hasMamad: true,
      } as any
    );

    expect(result.score).toBe(87);
    expect(result.reason).toContain("mamad");
  });

  it("throws if Claude's response is not valid JSON", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue("not json");

    await expect(
      scoreListing({ learnedSummary: "" } as any, { address: "X" } as any)
    ).rejects.toThrow();
  });
});
