// tests/unit/yad2-parser.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseListingsFromHtml } from "@/scraper/yad2-parser";

describe("parseListingsFromHtml", () => {
  const html = readFileSync(join(__dirname, "../fixtures/yad2-search-results.html"), "utf-8");

  it("extracts all listings with correct fields", () => {
    const listings = parseListingsFromHtml(html);
    expect(listings).toHaveLength(2);

    expect(listings[0]).toEqual({
      sourceUrl: "https://www.yad2.co.il/item/1001",
      address: "Rothschild 12, Tel Aviv",
      price: 2450000,
      rooms: 4,
      sizeSqm: 95,
      floor: 3,
      hasParking: true,
      hasBalcony: true,
      hasMamad: true,
      hasElevator: true,
      description: "Renovated apartment near the park.",
      photoUrl: "https://img.yad2.co.il/1001.jpg",
    });
  });

  it("defaults missing feature flags to false", () => {
    const listings = parseListingsFromHtml(html);
    expect(listings[1].hasParking).toBe(false);
    expect(listings[1].hasMamad).toBe(false);
  });
});
