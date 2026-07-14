import { describe, it, expect } from "vitest";
import { htmlToText, parseExtractedFields } from "@/lib/extract-listing";
import { looksLikeBotChallenge } from "@/lib/bot-challenge";

describe("looksLikeBotChallenge", () => {
  it("flags a Radware challenge page", () => {
    expect(looksLikeBotChallenge("<html><body>Radware Page ...</body></html>")).toBe(true);
  });
  it("passes a normal page", () => {
    expect(looksLikeBotChallenge("<html><body>דירה למכירה</body></html>")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips scripts/styles and collapses whitespace", () => {
    const html = `<html><head><style>.x{color:red}</style></head><body>
      <script>var a = 1;</script>
      <h1>דירה   3   חדרים</h1>
    </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("דירה 3 חדרים");
    expect(text).not.toContain("var a");
    expect(text).not.toContain("color:red");
  });
});

describe("parseExtractedFields", () => {
  it("parses a clean JSON object (with code fences)", () => {
    const raw = '```json\n{"address":"בן יהודה 42","price":2650000,"rooms":3,"sizeSqm":78,"floor":2,"hasParking":false,"hasBalcony":true,"hasMamad":true,"hasElevator":false,"description":"נחמדה"}\n```';
    const fields = parseExtractedFields(raw);
    expect(fields).not.toBeNull();
    expect(fields!.address).toBe("בן יהודה 42");
    expect(fields!.price).toBe(2650000);
    expect(fields!.hasBalcony).toBe(true);
    expect(fields!.hasParking).toBe(false);
  });
  it("coerces missing/garbage values to null/false", () => {
    const fields = parseExtractedFields('{"address":"","price":"lots","rooms":3}');
    expect(fields!.address).toBeNull();
    expect(fields!.price).toBeNull();
    expect(fields!.rooms).toBe(3);
    expect(fields!.hasMamad).toBe(false);
  });
  it("returns null for non-JSON", () => {
    expect(parseExtractedFields("sorry, I couldn't find anything")).toBeNull();
  });
  it("rounds integer-typed fields but keeps fractional rooms", () => {
    const fields = parseExtractedFields('{"price":2650000.4,"sizeSqm":78.6,"floor":2.9,"rooms":3.5}');
    expect(fields!.price).toBe(2650000);
    expect(fields!.sizeSqm).toBe(79);
    expect(fields!.floor).toBe(3);
    expect(fields!.rooms).toBe(3.5);
  });
});
