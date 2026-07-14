# Add-listing-by-URL + source links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user add listings by pasting a URL (best-effort auto-fill via server fetch + Claude, with a manual fallback), link each card to its original page, and surface source-site links for manual browsing.

**Architecture:** A pure extraction lib (`extract-listing.ts`) fetches a URL, reuses the existing bot-challenge detector, and asks Claude to extract fields. Two API endpoints — `POST /api/listings/extract` (parse only) and `POST /api/listings` (validate → dedup → best-effort score → create). A gated `/add` page with a client `AddListingForm` drives it. Cards gain an "original" link; `/listings` gains a source-links block.

**Tech Stack:** Next.js 14 (App Router), React 18, Prisma + SQLite, Zod, `@anthropic-ai/sdk`, Cheerio, Vitest, Playwright.

**Scope note:** New feature (spec: `docs/superpowers/specs/2026-07-14-add-listing-by-url-design.md`). Chosen to precede the map view. Builds on Phases 1–2 (merged).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/types/listing.ts` | Add `sourceUrl`, `sourceSite` | Modify |
| `src/components/ListingCard.tsx` | Render "original" link | Modify |
| `src/app/page.tsx` | Original link on dashboard favorite cards | Modify |
| `src/app/globals.css` | Link + source-block + add-form styles | Modify |
| `src/components/SourceLinks.tsx` | Yad2/Madlan browse links | Create |
| `src/app/listings/ListingsClient.tsx` | Render `SourceLinks` | Modify |
| `src/lib/bot-challenge.ts` | Shared `looksLikeBotChallenge` | Create |
| `src/scraper/run.ts` | Import the shared detector | Modify |
| `src/lib/extract-listing.ts` | Fetch + clean + Claude extraction | Create |
| `src/app/api/listings/extract/route.ts` | `POST` parse-only | Create |
| `src/lib/validation.ts` | `extractUrlSchema`, `addListingSchema` | Modify |
| `src/app/api/listings/route.ts` | Add `POST` create | Modify |
| `src/app/add/page.tsx` | Gated add page | Create |
| `src/components/AddListingForm.tsx` | The add form (client) | Create |
| `src/components/Header.tsx` | "הוספה" nav item | Modify |
| `tests/unit/extract-listing.test.ts` | Pure-function + block coverage | Create |
| `tests/integration/listings-create-route.test.ts` | Create + dedup + validation | Create |
| `tests/integration/listings-extract-route.test.ts` | Extract route (mocked I/O) | Create |
| `tests/e2e/add-listing.spec.ts` | Manual add flow | Create |

---

## Task 1: Thread `sourceUrl`/`sourceSite` + "original" link on cards

**Files:** Modify `src/types/listing.ts`, `src/components/ListingCard.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Extend the Listing type**

Replace `src/types/listing.ts` with:

```ts
export interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
  sourceUrl: string;
  sourceSite: string;
}
```

- [ ] **Step 2: Add the original link to `ListingCard`**

In `src/components/ListingCard.tsx`, add `sourceUrl: string;` to the `ListingCardProps` interface, add `sourceUrl` to the destructured params, and add the link at the end of the actions row. Replace the `listing__actions` block with:

```tsx
      <div className="listing__actions">
        <button className="btn-like" onClick={() => onFeedback(id, "like")} disabled={disabled}>
          שמור
        </button>
        <button className="btn-dislike" onClick={() => onFeedback(id, "dislike")} disabled={disabled}>
          לא מתאים
        </button>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="listing__source"
          onClick={(e) => e.stopPropagation()}
        >
          למודעה המקורית ↗
        </a>
      </div>
```

- [ ] **Step 3: Add the original link to dashboard favorite cards**

In `src/app/page.tsx`, the favorites map renders `<article className="listing">…</article>`. Add a source link after the `listing__meta` paragraph, inside the article:

```tsx
                <p className="listing__meta">
                  ₪{l.price.toLocaleString()} · {l.rooms} חד&apos; · {l.sizeSqm} מ&quot;ר
                  {l.matchScore !== null ? ` · ${l.matchScore}/100` : ""}
                </p>
                <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="listing__source">
                  למודעה המקורית ↗
                </a>
```

- [ ] **Step 4: Style the link**

Append to `src/app/globals.css`:

```css
.listing__source {
  display: inline-block;
  margin-inline-start: auto;
  color: var(--accent);
  font-size: 13px;
}

article.listing .listing__source {
  margin-top: 10px;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → no errors. (Both the feed `{...listing}` spread and the dashboard's direct Prisma row already carry `sourceUrl`/`sourceSite`; the type now reflects it.)

- [ ] **Step 6: Commit**

```bash
git add src/types/listing.ts src/components/ListingCard.tsx src/app/page.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: link each listing card to its original source page"
```

---

## Task 2: Source-site browse links on `/listings`

**Files:** Create `src/components/SourceLinks.tsx`; Modify `src/app/listings/ListingsClient.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create the component**

Create `src/components/SourceLinks.tsx`:

```tsx
const SOURCES = [
  { label: "יד2 — דירות למכירה", href: "https://www.yad2.co.il/realestate/forsale" },
  { label: "מדלן", href: "https://www.madlan.co.il" },
];

export function SourceLinks() {
  return (
    <div className="source-links">
      <span className="source-links__label">מקורות לחיפוש עצמאי</span>
      {SOURCES.map((s) => (
        <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
          {s.label} ↗
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the listings page**

In `src/app/listings/ListingsClient.tsx`, add the import near the top (with the other imports):

```tsx
import { SourceLinks } from "@/components/SourceLinks";
```

Then render it right after the `<p className="page-subtitle">…</p>` line and before the `control-row` div:

```tsx
      <SourceLinks />
```

- [ ] **Step 3: Style it**

Append to `src/app/globals.css`:

```css
.source-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  font-size: 13px;
}

.source-links__label {
  color: var(--text-muted);
}

.source-links a {
  color: var(--accent);
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` → no errors.

```bash
git add src/components/SourceLinks.tsx src/app/listings/ListingsClient.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: source-site browse links on the listings page"
```

---

## Task 3: Extraction lib (shared block-detector + pure helpers)

**Files:** Create `src/lib/bot-challenge.ts`, `src/lib/extract-listing.ts`; Modify `src/scraper/run.ts`; Test `tests/unit/extract-listing.test.ts`

- [ ] **Step 1: Lift the bot-challenge detector into a shared module**

Create `src/lib/bot-challenge.ts`:

```ts
// Detects anti-bot challenge/interstitial pages (e.g. Yad2's Radware) so callers
// can treat a fetched page as "blocked" rather than parsing junk.
export function looksLikeBotChallenge(html: string): boolean {
  return (
    html.includes("Radware Page") ||
    html.includes("verify-message") ||
    /Incident ID/i.test(html)
  );
}
```

In `src/scraper/run.ts`, delete the local `looksLikeBotChallenge` function (the whole `function looksLikeBotChallenge(html: string): boolean { … }` block) and import it instead. Add this import near the top with the other imports:

```ts
import { looksLikeBotChallenge } from "@/lib/bot-challenge";
```

- [ ] **Step 2: Write the failing unit test**

Create `tests/unit/extract-listing.test.ts`:

```ts
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
});
```

- [ ] **Step 3: Run it, verify it FAILS**

Run: `npx vitest run tests/unit/extract-listing.test.ts`
Expected: FAIL — `@/lib/extract-listing` doesn't exist yet.

- [ ] **Step 4: Implement the extraction lib**

Create `src/lib/extract-listing.ts`:

```ts
import { load } from "cheerio";
import { askClaude } from "@/lib/claude";
import { looksLikeBotChallenge } from "@/lib/bot-challenge";

export interface ExtractedFields {
  address: string | null;
  price: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  floor: number | null;
  hasParking: boolean;
  hasBalcony: boolean;
  hasMamad: boolean;
  hasElevator: boolean;
  description: string | null;
}

export type ExtractResult =
  | { ok: true; fields: ExtractedFields }
  | { ok: false; reason: "blocked" | "fetch_failed" | "parse_failed" };

const MAX_TEXT = 6000;

export function htmlToText(html: string): string {
  const $ = load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

export function parseExtractedFields(raw: string): ExtractedFields | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const bool = (v: unknown) => v === true;
  return {
    address: str(o.address),
    price: num(o.price),
    rooms: num(o.rooms),
    sizeSqm: num(o.sizeSqm),
    floor: num(o.floor),
    hasParking: bool(o.hasParking),
    hasBalcony: bool(o.hasBalcony),
    hasMamad: bool(o.hasMamad),
    hasElevator: bool(o.hasElevator),
    description: str(o.description),
  };
}

function extractionPrompt(text: string): string {
  return `Extract real-estate listing details from the page text below. Respond with ONLY a JSON object with these keys (use null when unknown): {"address": string|null, "price": number|null (shekels, integer), "rooms": number|null, "sizeSqm": number|null (integer), "floor": number|null, "hasParking": boolean, "hasBalcony": boolean, "hasMamad": boolean, "hasElevator": boolean, "description": string|null}. No other text.

Page text:
${text}`;
}

export async function extractListingFromUrl(url: string): Promise<ExtractResult> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    html = await res.text();
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  if (looksLikeBotChallenge(html)) return { ok: false, reason: "blocked" };

  let raw: string;
  try {
    raw = await askClaude(extractionPrompt(htmlToText(html)));
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  const fields = parseExtractedFields(raw);
  return fields ? { ok: true, fields } : { ok: false, reason: "parse_failed" };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/unit/extract-listing.test.ts` → PASS (6 assertions across 3 describes).
Run: `npx tsc --noEmit` → no errors (confirms `run.ts` still compiles after the detector move).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot-challenge.ts src/lib/extract-listing.ts src/scraper/run.ts tests/unit/extract-listing.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: listing extraction lib with shared bot-challenge detector"
```

---

## Task 4: `POST /api/listings/extract`

**Files:** Modify `src/lib/validation.ts`; Create `src/app/api/listings/extract/route.ts`, `tests/integration/listings-extract-route.test.ts`

- [ ] **Step 1: Add the URL schema**

Append to `src/lib/validation.ts`:

```ts
export const extractUrlSchema = z.object({ url: z.string().url() });
```

- [ ] **Step 2: Write the failing test**

Create `tests/integration/listings-extract-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/claude", () => ({
  askClaude: vi.fn(async () =>
    JSON.stringify({
      address: "בדיקה 1",
      price: 2500000,
      rooms: 3,
      sizeSqm: 80,
      floor: 2,
      hasParking: true,
      hasBalcony: false,
      hasMamad: true,
      hasElevator: false,
      description: null,
    })
  ),
}));

import { POST } from "@/app/api/listings/extract/route";

function req(body: unknown) {
  return new Request("http://localhost/api/listings/extract", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/listings/extract", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns extracted fields on a normal page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>דירה</body></html>", { status: 200 })));
    const res = await POST(req({ url: "https://example.com/listing/1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.fields.address).toBe("בדיקה 1");
  });

  it("reports blocked on a Radware challenge page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>Radware Page verify-message</body></html>", { status: 200 })));
    const res = await POST(req({ url: "https://www.yad2.co.il/item/1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("blocked");
  });

  it("400s on a non-URL body", async () => {
    const res = await POST(req({ url: "not a url" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run it, verify it FAILS**

Run: `npx vitest run tests/integration/listings-extract-route.test.ts`
Expected: FAIL — the route doesn't exist.

- [ ] **Step 4: Implement the route**

Create `src/app/api/listings/extract/route.ts`:

```ts
import { NextResponse } from "next/server";
import { extractUrlSchema } from "@/lib/validation";
import { extractListingFromUrl } from "@/lib/extract-listing";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = extractUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // A block/parse-miss is a normal, expected outcome the UI handles — return 200
  // with the result discriminant rather than an error status.
  const result = await extractListingFromUrl(parsed.data.url);
  return NextResponse.json(result);
}
```

- [ ] **Step 5: Run tests, verify PASS**

Run: `npx vitest run tests/integration/listings-extract-route.test.ts` → PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/app/api/listings/extract/route.ts tests/integration/listings-extract-route.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: POST /api/listings/extract for URL auto-fill"
```

---

## Task 5: `POST /api/listings` create

**Files:** Modify `src/lib/validation.ts`, `src/app/api/listings/route.ts`; Create `tests/integration/listings-create-route.test.ts`

- [ ] **Step 1: Add the create schema**

Append to `src/lib/validation.ts`:

```ts
export const addListingSchema = z.object({
  url: z.string().url(),
  address: z.string().min(1),
  price: z.number().int().positive(),
  rooms: z.number().positive(),
  sizeSqm: z.number().int().positive(),
  floor: z.number().int().nullable().optional(),
  hasParking: z.boolean().default(false),
  hasBalcony: z.boolean().default(false),
  hasMamad: z.boolean().default(false),
  hasElevator: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

export type AddListingInput = z.infer<typeof addListingSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `tests/integration/listings-create-route.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/scoring", () => ({
  scoreListing: vi.fn(async () => ({ score: 77, reason: "בדיקה" })),
}));

import { POST } from "@/app/api/listings/route";
import { db } from "@/lib/db";

const base = {
  url: "https://www.yad2.co.il/item/create-test-1",
  address: "יצירה 1",
  price: 2400000,
  rooms: 3,
  sizeSqm: 75,
  hasParking: true,
};

function req(body: unknown) {
  return new Request("http://localhost/api/listings", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/listings", () => {
  afterEach(async () => {
    await db.listing.deleteMany({ where: { address: "יצירה 1" } });
  });

  it("creates a listing, deriving sourceSite and scoring it", async () => {
    const res = await POST(req(base));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.listing.sourceSite).toBe("yad2");
    expect(body.listing.matchScore).toBe(77);
    expect(body.listing.hasParking).toBe(true);
  });

  it("rejects a duplicate sourceUrl with 409", async () => {
    await POST(req(base));
    const res = await POST(req(base));
    expect(res.status).toBe(409);
  });

  it("400s on invalid input", async () => {
    const res = await POST(req({ url: "https://x.com/y", address: "", price: -1 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run it, verify it FAILS**

Run: `npx vitest run tests/integration/listings-create-route.test.ts`
Expected: FAIL — `POST` is not exported from the listings route yet.

- [ ] **Step 4: Add the POST handler**

In `src/app/api/listings/route.ts`, keep the existing `GET`. Add these imports at the top (next to the existing ones):

```ts
import { addListingSchema } from "@/lib/validation";
import { scoreListing } from "@/lib/scoring";
```

Add this `deriveSourceSite` helper and `POST` handler below the existing `GET`:

```ts
function deriveSourceSite(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "unknown";
  }
  if (host.includes("yad2")) return "yad2";
  if (host.includes("madlan")) return "madlan";
  return host.replace(/^www\./, "");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const duplicate = await db.listing.findUnique({ where: { sourceUrl: data.url } });
  if (duplicate) {
    return NextResponse.json({ error: "Listing already exists" }, { status: 409 });
  }

  // Best-effort scoring against the current profile — a scoring failure (or no
  // API key) must not block creating the listing (matches the scraper's behavior).
  let matchScore: number | null = null;
  let matchReason: string | null = null;
  const profile = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (profile) {
    try {
      const result = await scoreListing(profile, {
        address: data.address,
        price: data.price,
        rooms: data.rooms,
        sizeSqm: data.sizeSqm,
        floor: data.floor ?? null,
        hasParking: data.hasParking,
        hasBalcony: data.hasBalcony,
        hasMamad: data.hasMamad,
        hasElevator: data.hasElevator,
        description: data.description ?? null,
      });
      matchScore = result.score;
      matchReason = result.reason;
    } catch (err) {
      console.warn("POST /api/listings: scoring failed, saving unscored:", err);
    }
  }

  const listing = await db.listing.create({
    data: {
      sourceSite: deriveSourceSite(data.url),
      sourceUrl: data.url,
      address: data.address,
      price: data.price,
      rooms: data.rooms,
      sizeSqm: data.sizeSqm,
      floor: data.floor ?? null,
      hasParking: data.hasParking,
      hasBalcony: data.hasBalcony,
      hasMamad: data.hasMamad,
      hasElevator: data.hasElevator,
      description: data.description ?? null,
      matchScore,
      matchReason,
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
```

- [ ] **Step 5: Run tests, verify PASS**

Run: `npx vitest run tests/integration/listings-create-route.test.ts` → PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/app/api/listings/route.ts tests/integration/listings-create-route.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: POST /api/listings to create a listing from submitted fields"
```

---

## Task 6: `/add` page + `AddListingForm` + nav

**Files:** Create `src/app/add/page.tsx`, `src/components/AddListingForm.tsx`; Modify `src/components/Header.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create the client form**

Create `src/components/AddListingForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtractedFields } from "@/lib/extract-listing";

const EMPTY: ExtractedFields = {
  address: null, price: null, rooms: null, sizeSqm: null, floor: null,
  hasParking: false, hasBalcony: false, hasMamad: false, hasElevator: false, description: null,
};

export function AddListingForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<ExtractedFields>(EMPTY);
  const [filling, setFilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ExtractedFields>(key: K, value: ExtractedFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function autoFill() {
    if (!url) return;
    setFilling(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/listings/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        setFields({ ...EMPTY, ...data.fields });
        setNotice("מילאנו את מה שהצלחנו — בדקו והשלימו.");
      } else {
        setNotice("לא הצלחנו למלא אוטומטית — מלאו ידנית.");
      }
    } catch {
      setNotice("לא הצלחנו למלא אוטומטית — מלאו ידנית.");
    } finally {
      setFilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, ...fields }),
    });
    setSubmitting(false);
    if (res.status === 201) {
      const data = await res.json();
      router.push(`/listings/${data.listing.id}`);
      return;
    }
    if (res.status === 409) {
      setError("המודעה כבר קיימת.");
      return;
    }
    setError("יש לבדוק את הטופס — משהו חסר או לא תקין.");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        קישור למודעה
        <input
          name="url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.yad2.co.il/item/..."
        />
      </label>
      <button type="button" onClick={autoFill} disabled={filling || !url}>
        {filling ? "ממלא…" : "מלא אוטומטית"}
      </button>
      {notice && <p className="form-notice">{notice}</p>}

      <label>כתובת<input value={fields.address ?? ""} onChange={(e) => set("address", e.target.value || null)} required /></label>
      <label>מחיר (₪)<input type="number" value={fields.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>חדרים<input type="number" step="0.5" value={fields.rooms ?? ""} onChange={(e) => set("rooms", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>שטח (מ&quot;ר)<input type="number" value={fields.sizeSqm ?? ""} onChange={(e) => set("sizeSqm", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>קומה<input type="number" value={fields.floor ?? ""} onChange={(e) => set("floor", e.target.value ? Number(e.target.value) : null)} /></label>
      <label><input type="checkbox" checked={fields.hasParking} onChange={(e) => set("hasParking", e.target.checked)} /> חניה</label>
      <label><input type="checkbox" checked={fields.hasBalcony} onChange={(e) => set("hasBalcony", e.target.checked)} /> מרפסת</label>
      <label><input type="checkbox" checked={fields.hasMamad} onChange={(e) => set("hasMamad", e.target.checked)} /> ממ&quot;ד</label>
      <label><input type="checkbox" checked={fields.hasElevator} onChange={(e) => set("hasElevator", e.target.checked)} /> מעלית</label>
      <label>תיאור<textarea value={fields.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "מוסיף…" : "הוספת מודעה"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the gated add page**

Create `src/app/add/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { AddListingForm } from "@/components/AddListingForm";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main>
      <h1>הוספת מודעה</h1>
      <p className="page-subtitle">
        הדביקו קישור למודעה ונמלא את הפרטים אוטומטית — אפשר גם למלא ידנית.
      </p>
      <AddListingForm />
    </main>
  );
}
```

- [ ] **Step 3: Add the nav item**

In `src/components/Header.tsx`, add `{ href: "/add", label: "הוספה" }` to the `NAV` array (after the `/profile` entry):

```tsx
const NAV = [
  { href: "/", label: "לוח בקרה" },
  { href: "/listings", label: "מודעות" },
  { href: "/compare", label: "השוואה" },
  { href: "/profile", label: "פרופיל" },
  { href: "/add", label: "הוספה" },
];
```

- [ ] **Step 4: Style the auto-fill button + notice**

Append to `src/app/globals.css`:

```css
.form-notice {
  color: var(--text-muted);
  font-size: 14px;
}

form button[type="button"] {
  align-self: flex-start;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build 2>&1 | tail -20` → `/add` compiles (dynamic ƒ).

- [ ] **Step 6: Commit**

```bash
git add src/app/add/page.tsx src/components/AddListingForm.tsx src/components/Header.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: add-listing-by-URL page, form, and nav item"
```

---

## Task 7: E2E — manual add flow

**Files:** Create `tests/e2e/add-listing.spec.ts`

- [ ] **Step 1: Write the e2e**

Create `tests/e2e/add-listing.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/add-listing.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("add listing by URL", () => {
  const sourceUrl = `https://www.yad2.co.il/item/e2e-add-${Date.now()}`;
  const address = `Add Test St ${Date.now()}`;
  let createdProfileId: string | null = null;

  test.beforeEach(async () => {
    const anyProfile = await db.preferenceProfile.findFirst();
    if (!anyProfile) {
      const created = await db.preferenceProfile.create({
        data: {
          locations: JSON.stringify(["Tel Aviv"]),
          budgetMax: 3000000,
          mustHaveExtras: JSON.stringify([]),
          goal: "primary",
          exampleUrls: JSON.stringify([]),
        },
      });
      createdProfileId = created.id;
    } else {
      createdProfileId = null;
    }
  });

  test.afterEach(async () => {
    await db.listing.deleteMany({ where: { sourceUrl } });
    if (createdProfileId) {
      await db.preferenceProfile.delete({ where: { id: createdProfileId } });
      createdProfileId = null;
    }
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("manually add a listing and land on its detail page", async ({ page }) => {
    await page.goto("/add");

    await page.fill('input[name="url"]', sourceUrl);
    await page.getByLabel("כתובת").fill(address);
    await page.getByLabel("מחיר (₪)").fill("2450000");
    await page.getByLabel("חדרים").fill("3");
    await page.getByLabel('שטח (מ"ר)').fill("72");

    await page.getByRole("button", { name: "הוספת מודעה", exact: true }).click();

    await expect(page).toHaveURL(/\/listings\/[a-z0-9]+$/);
    await expect(page.locator("h1")).toContainText(address);
  });
});
```

Note on selectors: the form's fields use `<label>text<input/></label>` wrapping, which associates the label text as the control's accessible name, so `getByLabel("כתובת")` etc. resolve. The submit lands on `/listings/[id]` (Task 5 returns the created id; Task 6 routes to it).

- [ ] **Step 2: Run the e2e**

Run: `npx playwright test tests/e2e/add-listing.spec.ts`
Expected: PASS. (If a stale dev server on :3000 or stale `.next` causes failures, kill the port-3000 process, delete `.next`, and let Playwright start fresh; retry once.)

- [ ] **Step 3: Run the full suites**

Run: `npx vitest run` → all pass.
Run: `npx playwright test` → all e2e specs pass (onboarding, feed-and-feedback, listing-detail, add-listing).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/add-listing.spec.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "test: e2e for the manual add-listing flow"
```

---

## Done criteria

- Every listing card (feed + dashboard) links to its original source page.
- `/listings` shows Yad2/Madlan browse links.
- `/add` (in the nav) lets the user paste a URL, auto-fill best-effort (manual fallback on block), edit, and save — landing on the new listing's detail page, scored against their profile.
- Duplicate URLs are rejected; invalid input is rejected.
- `npx vitest run` and `npx playwright test` both green.
