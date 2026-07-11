// src/scraper/dedup.ts
import type { ParsedListing } from "@/scraper/yad2-parser";

export function filterNewListings(
  scraped: ParsedListing[],
  existingSourceUrls: Set<string>
): ParsedListing[] {
  return scraped.filter((listing) => !existingSourceUrls.has(listing.sourceUrl));
}
