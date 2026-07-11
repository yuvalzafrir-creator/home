// src/scraper/yad2-parser.ts
import { load } from "cheerio";

export interface ParsedListing {
  sourceUrl: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  floor: number | null;
  hasParking: boolean;
  hasBalcony: boolean;
  hasMamad: boolean;
  hasElevator: boolean;
  description: string | null;
  photoUrl: string | null;
}

export function parseListingsFromHtml(html: string): ParsedListing[] {
  const $ = load(html);
  const listings: ParsedListing[] = [];

  $(".feeditem").each((_, el) => {
    const node = $(el);
    const features = (node.find(".features").text() || "").split(",").map((f) => f.trim());

    listings.push({
      sourceUrl: node.attr("data-url") ?? "",
      address: node.find(".address").text().trim(),
      price: parseInt(node.find(".price").text().replace(/,/g, ""), 10),
      rooms: parseFloat(node.find(".rooms").text()),
      sizeSqm: parseInt(node.find(".size").text(), 10),
      floor: node.find(".floor").text() ? parseInt(node.find(".floor").text(), 10) : null,
      hasParking: features.includes("parking"),
      hasBalcony: features.includes("balcony"),
      hasMamad: features.includes("mamad"),
      hasElevator: features.includes("elevator"),
      description: node.find(".description").text().trim() || null,
      photoUrl: node.find(".photo").attr("src") ?? null,
    });
  });

  return listings;
}
