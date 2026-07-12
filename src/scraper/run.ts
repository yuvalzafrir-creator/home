// src/scraper/run.ts
import { chromium } from "playwright";
import { db } from "@/lib/db";
import { parseListingsFromHtml, type ParsedListing } from "@/scraper/yad2-parser";
import { filterNewListings } from "@/scraper/dedup";
import { scoreListing } from "@/lib/scoring";

function isValidListing(listing: ParsedListing): boolean {
  return (
    listing.sourceUrl.length > 0 &&
    !Number.isNaN(listing.price) &&
    !Number.isNaN(listing.rooms) &&
    !Number.isNaN(listing.sizeSqm)
  );
}

export async function runScrapePipeline(searchUrl: string): Promise<void> {
  const run = await db.scrapeRun.create({ data: {} });

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(searchUrl);
    const html = await page.content();
    await browser.close();

    const scraped = parseListingsFromHtml(html);

    const validScraped = scraped.filter(isValidListing);
    const skippedCount = scraped.length - validScraped.length;
    if (skippedCount > 0) {
      console.warn(
        `runScrapePipeline: skipped ${skippedCount} listing(s) with a missing sourceUrl or malformed numeric field. This usually means Yad2's markup no longer matches the parser's selectors and they need updating.`
      );
    }

    const existing = await db.listing.findMany({ select: { sourceUrl: true } });
    const existingUrls = new Set(existing.map((l) => l.sourceUrl));
    const newListings = filterNewListings(validScraped, existingUrls);

    const profile = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });

    for (const listing of newListings) {
      const { score, reason } = profile
        ? await scoreListing(profile, listing)
        : { score: null, reason: null };

      await db.listing.create({
        data: {
          sourceSite: "yad2",
          sourceUrl: listing.sourceUrl,
          address: listing.address,
          price: listing.price,
          rooms: listing.rooms,
          sizeSqm: listing.sizeSqm,
          floor: listing.floor,
          hasParking: listing.hasParking,
          hasBalcony: listing.hasBalcony,
          hasMamad: listing.hasMamad,
          hasElevator: listing.hasElevator,
          description: listing.description,
          photoUrl: listing.photoUrl,
          matchScore: score,
          matchReason: reason,
        },
      });
    }

    await db.scrapeRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), success: true, newListings: newListings.length },
    });
  } catch (err) {
    await db.scrapeRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

if (require.main === module) {
  const url = process.env.YAD2_SEARCH_URL ?? "https://www.yad2.co.il/realestate/forsale";
  runScrapePipeline(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
