// tests/unit/dedup.test.ts
import { describe, it, expect } from "vitest";
import { filterNewListings } from "@/scraper/dedup";
import type { ParsedListing } from "@/scraper/yad2-parser";

function listing(sourceUrl: string): ParsedListing {
  return {
    sourceUrl,
    address: "Test St 1",
    price: 1000000,
    rooms: 3,
    sizeSqm: 60,
    floor: 1,
    hasParking: false,
    hasBalcony: false,
    hasMamad: false,
    hasElevator: false,
    description: null,
    photoUrl: null,
  };
}

describe("filterNewListings", () => {
  it("keeps only listings whose sourceUrl is not in the existing set", () => {
    const scraped = [listing("https://yad2.co.il/item/1"), listing("https://yad2.co.il/item/2")];
    const existingUrls = new Set(["https://yad2.co.il/item/1"]);

    const result = filterNewListings(scraped, existingUrls);

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe("https://yad2.co.il/item/2");
  });

  it("returns all listings when none exist yet", () => {
    const scraped = [listing("https://yad2.co.il/item/1")];
    const result = filterNewListings(scraped, new Set());
    expect(result).toHaveLength(1);
  });
});
