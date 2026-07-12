// tests/integration/pipeline.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { runScrapePipeline } from "@/scraper/run";
import { db } from "@/lib/db";
import * as scoring from "@/lib/scoring";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue(
          readFileSync(join(__dirname, "../fixtures/yad2-search-results.html"), "utf-8")
        ),
      }),
      close: vi.fn(),
    }),
  },
}));

describe("runScrapePipeline", () => {
  afterEach(async () => {
    await db.listing.deleteMany();
    await db.scrapeRun.deleteMany();
    await db.preferenceProfile.deleteMany();
  });

  it("saves new listings with scores and logs a successful ScrapeRun", async () => {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
        learnedSummary: "Wants a 3-4 room apartment in Tel Aviv.",
      },
    });

    vi.spyOn(scoring, "scoreListing").mockResolvedValue({ score: 80, reason: "Good match" });

    const result = await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");
    expect(result).toEqual({ success: true });

    const listings = await db.listing.findMany();
    expect(listings).toHaveLength(2);
    expect(listings[0].matchScore).toBe(80);

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(true);
    expect(runs[0].newListings).toBe(2);
    expect(runs[0].skippedListings).toBe(0);
    expect(runs[0].failedScoring).toBe(0);
  });

  it("logs a failed ScrapeRun without throwing when the page navigation fails", async () => {
    const playwright = await import("playwright");
    (playwright.chromium.launch as any).mockResolvedValueOnce({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockRejectedValue(new Error("net::ERR_CONNECTION_RESET")),
        content: vi.fn(),
      }),
      close: vi.fn(),
    });

    const result = await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");
    expect(result).toEqual({ success: false });

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(false);
    expect(runs[0].errorMessage).toContain("ERR_CONNECTION_RESET");
    expect(runs[0].skippedListings).toBe(0);
    expect(runs[0].failedScoring).toBe(0);
  });

  it("skips listings with no sourceUrl or NaN numeric fields instead of crashing or inserting bad data", async () => {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });

    vi.spyOn(scoring, "scoreListing").mockResolvedValue({ score: 80, reason: "Good match" });

    const malformedHtml = `
      <div class="feed-list">
        <div class="feeditem" data-url="">
          <span class="address">No URL St</span>
          <span class="price">1,000,000</span>
          <span class="rooms">3</span>
          <span class="size">60</span>
        </div>
        <div class="feeditem" data-url="https://www.yad2.co.il/item/9999">
          <span class="address">Bad Price St</span>
          <span class="price">not-a-number</span>
          <span class="rooms">3</span>
          <span class="size">60</span>
        </div>
      </div>
    `;
    const playwright = await import("playwright");
    (playwright.chromium.launch as any).mockResolvedValueOnce({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue(malformedHtml),
      }),
      close: vi.fn(),
    });

    await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");

    const listings = await db.listing.findMany();
    expect(listings).toHaveLength(0);

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(true);
    expect(runs[0].newListings).toBe(0);
    expect(runs[0].skippedListings).toBe(2);
    expect(runs[0].failedScoring).toBe(0);
  });

  it("persists a listing with a null score when scoreListing throws, without aborting the run", async () => {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
        learnedSummary: "Wants a 3-4 room apartment in Tel Aviv.",
      },
    });

    vi.spyOn(scoring, "scoreListing")
      .mockRejectedValueOnce(new Error("Unexpected scoring response shape"))
      .mockResolvedValueOnce({ score: 80, reason: "Good match" });

    const result = await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");
    expect(result).toEqual({ success: true });

    const listings = await db.listing.findMany({ orderBy: { sourceUrl: "asc" } });
    expect(listings).toHaveLength(2);
    const scored = listings.filter((l) => l.matchScore !== null);
    const unscored = listings.filter((l) => l.matchScore === null);
    expect(scored).toHaveLength(1);
    expect(scored[0].matchScore).toBe(80);
    expect(unscored).toHaveLength(1);
    expect(unscored[0].matchReason).toBeNull();

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(true);
    expect(runs[0].newListings).toBe(2);
    expect(runs[0].failedScoring).toBe(1);
  });
});
