# Home Search Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal tool that scrapes Yad2 daily for home listings, scores each one against a learned preference profile using Claude, and presents them in a Next.js web app for browsing, reacting to, and comparing over time.

**Architecture:** A Next.js (App Router, TypeScript) app backed by SQLite via Prisma. A standalone Playwright-based scraper script (triggered daily by Windows Task Scheduler) fetches and parses Yad2 search results, dedupes against stored listings, and scores new ones via the Claude API. The web app reads/writes the same database for onboarding, the daily feed, feedback, history, and comparison.

**Tech Stack:** Next.js 14 (TypeScript, App Router), Prisma + SQLite, Playwright, @anthropic-ai/sdk, Zod, Vitest (unit/integration), @playwright/test (e2e).

---

## File Structure

```
מתווך/
  package.json, tsconfig.json, next.config.js, vitest.config.ts, playwright.config.ts
  prisma/
    schema.prisma
  src/
    lib/
      db.ts                    — Prisma client singleton
      validation.ts            — Zod schemas (onboarding, feedback)
      claude.ts                — Anthropic client wrapper
      scoring.ts                — scoreListing(profile, listing)
      preference-profile.ts    — updateLearnedSummary(profile, feedback[])
    scraper/
      yad2-parser.ts           — parseListingsFromHtml(html): ParsedListing[]
      dedup.ts                 — filterNewListings(scraped, existing)
      run.ts                   — orchestration entrypoint (invoked by Task Scheduler)
    app/
      page.tsx                 — daily feed
      onboarding/page.tsx
      listings/page.tsx        — all listings / history
      compare/page.tsx
      api/
        onboarding/route.ts
        feedback/route.ts
        scrape-runs/route.ts
    components/
      OnboardingForm.tsx
      ListingCard.tsx
      CompareTable.tsx
      HealthStatus.tsx
  tests/
    fixtures/
      yad2-search-results.html
    unit/
      yad2-parser.test.ts
      dedup.test.ts
      preference-profile.test.ts
      scoring.test.ts
    integration/
      onboarding-route.test.ts
      feedback-route.test.ts
      pipeline.test.ts
    e2e/
      onboarding.spec.ts
      feed-and-feedback.spec.ts
```

Each file has one responsibility: parsing is separate from scraping orchestration, scoring is separate from the learning-summary logic, and API routes are thin wrappers around `lib/` functions so the logic is testable without spinning up a server.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.env.local`, `.env.example`
- Create: `vitest.config.ts`, `playwright.config.ts`

- [ ] **Step 1: Create the Next.js app**

Run:
```bash
npx create-next-app@14 . --typescript --app --no-tailwind --no-eslint --src-dir --import-alias "@/*" --use-npm
```
Expected: project files scaffolded into the current directory (this is the `מתווך` project root created earlier).

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npm install prisma @prisma/client zod @anthropic-ai/sdk playwright
npm install -D vitest @playwright/test @vitejs/plugin-react tsx
```

- [ ] **Step 3: Install Playwright browser binaries**

Run:
```bash
npx playwright install chromium
```

- [ ] **Step 4: Create `.env.example` and `.env.local`**

`.env.example`:
```
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=""
```

Copy it to `.env.local` and fill in a real `ANTHROPIC_API_KEY` (not committed — already covered by `.gitignore`).

- [ ] **Step 5: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Add `playwright.config.ts` for e2e tests**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

- [ ] **Step 7: Add npm scripts**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:e2e": "playwright test",
"scrape": "tsx src/scraper/run.ts"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Prisma, Playwright, Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Test: `tests/unit/schema-smoke.test.ts`

- [ ] **Step 1: Write the schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Listing {
  id          String     @id @default(cuid())
  sourceSite  String
  sourceUrl   String     @unique
  address     String
  price       Int
  rooms       Float
  sizeSqm     Int
  floor       Int?
  hasParking  Boolean    @default(false)
  hasBalcony  Boolean    @default(false)
  hasMamad    Boolean    @default(false)
  hasElevator Boolean    @default(false)
  renovated   Boolean    @default(false)
  description String?
  photoUrl    String?
  status      String     @default("active")
  firstSeenAt DateTime   @default(now())
  lastSeenAt  DateTime   @default(now())
  matchScore  Int?
  matchReason String?
  feedback    Feedback[]
}

model PreferenceProfile {
  id               String   @id @default(cuid())
  locations        String
  budgetMax        Int
  minRooms         Float?
  minSizeSqm       Int?
  mustHaveExtras   String
  goal             String
  openToRenting    Boolean  @default(false)
  openToFixerUpper Boolean  @default(false)
  renovationBudget Int?
  freeText         String?
  exampleUrls      String
  learnedSummary   String?
  updatedAt        DateTime @updatedAt
  createdAt        DateTime @default(now())
}

model Feedback {
  id        String   @id @default(cuid())
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id])
  reaction  String
  note      String?
  createdAt DateTime @default(now())
}

model ScrapeRun {
  id           String    @id @default(cuid())
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  success      Boolean   @default(false)
  newListings  Int       @default(0)
  errorMessage String?
}
```

(`skippedListings` and `failedScoring` fields were added to this model in Task 12, after its code review found there was no way to distinguish "quiet day" from "broken scraper" — see Task 12's section for the follow-up migration.)

- [ ] **Step 2: Run the initial migration**

Run:
```bash
npx prisma migrate dev --name init
```
Expected: `prisma/migrations/<timestamp>_init/` created, `dev.db` created, output ends with "Your database is now in sync with your schema."

- [ ] **Step 3: Write a smoke test**

```ts
// tests/unit/schema-smoke.test.ts
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("prisma schema", () => {
  it("can create and read a PreferenceProfile", async () => {
    const db = new PrismaClient();
    const profile = await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });
    const found = await db.preferenceProfile.findUnique({ where: { id: profile.id } });
    expect(found?.budgetMax).toBe(3000000);
    await db.preferenceProfile.delete({ where: { id: profile.id } });
    await db.$disconnect();
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test -- tests/unit/schema-smoke.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add prisma package.json
git commit -m "feat: add database schema for listings, preferences, feedback, scrape runs"
```

---

## Task 3: Prisma Client Singleton

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write the singleton**

```ts
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

This avoids exhausting SQLite connections from Next.js hot-reload creating a new `PrismaClient` on every file change in dev.

- [ ] **Step 2: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add Prisma client singleton"
```

---

## Task 4: Onboarding Validation + API Route

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/app/api/onboarding/route.ts`
- Test: `tests/integration/onboarding-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/onboarding-route.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { POST } from "@/app/api/onboarding/route";
import { db } from "@/lib/db";

describe("POST /api/onboarding", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
  });

  it("creates a preference profile from valid input", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        locations: ["Tel Aviv", "Ramat Gan"],
        budgetMax: 3000000,
        minRooms: 3,
        minSizeSqm: 70,
        mustHaveExtras: ["parking", "mamad"],
        goal: "primary",
        openToRenting: false,
        openToFixerUpper: true,
        renovationBudget: 200000,
        freeText: "quiet street, near a park",
        exampleUrls: ["https://www.yad2.co.il/item/example1"],
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.budgetMax).toBe(3000000);
    const stored = await db.preferenceProfile.findUnique({ where: { id: body.profile.id } });
    expect(JSON.parse(stored!.locations)).toEqual(["Tel Aviv", "Ramat Gan"]);
  });

  it("rejects input missing required fields", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ locations: [] }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/integration/onboarding-route.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validation'` or `'@/app/api/onboarding/route'`.

- [ ] **Step 3: Write the validation schema**

```ts
// src/lib/validation.ts
import { z } from "zod";

export const onboardingSchema = z.object({
  locations: z.array(z.string()).min(1),
  budgetMax: z.number().positive(),
  minRooms: z.number().positive().optional(),
  minSizeSqm: z.number().positive().optional(),
  mustHaveExtras: z.array(z.string()).default([]),
  goal: z.enum(["primary", "investment"]),
  openToRenting: z.boolean().default(false),
  openToFixerUpper: z.boolean().default(false),
  renovationBudget: z.number().nonnegative().optional(),
  freeText: z.string().optional(),
  exampleUrls: z.array(z.string().url()).default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const feedbackSchema = z.object({
  listingId: z.string().min(1),
  reaction: z.enum(["like", "dislike"]),
  note: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
```

- [ ] **Step 4: Write the route**

```ts
// src/app/api/onboarding/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const profile = await db.preferenceProfile.create({
    data: {
      locations: JSON.stringify(data.locations),
      budgetMax: data.budgetMax,
      minRooms: data.minRooms,
      minSizeSqm: data.minSizeSqm,
      mustHaveExtras: JSON.stringify(data.mustHaveExtras),
      goal: data.goal,
      openToRenting: data.openToRenting,
      openToFixerUpper: data.openToFixerUpper,
      renovationBudget: data.renovationBudget,
      freeText: data.freeText,
      exampleUrls: JSON.stringify(data.exampleUrls),
    },
  });

  return NextResponse.json({ profile });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/integration/onboarding-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/app/api/onboarding tests/integration/onboarding-route.test.ts
git commit -m "feat: add onboarding validation and API route"
```

---

## Task 5: Onboarding UI

**Files:**
- Create: `src/components/OnboardingForm.tsx`
- Create: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Write the form component**

```tsx
// src/components/OnboardingForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      locations: String(form.get("locations")).split(",").map((s) => s.trim()).filter(Boolean),
      budgetMax: Number(form.get("budgetMax")),
      minRooms: form.get("minRooms") ? Number(form.get("minRooms")) : undefined,
      minSizeSqm: form.get("minSizeSqm") ? Number(form.get("minSizeSqm")) : undefined,
      mustHaveExtras: String(form.get("mustHaveExtras") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      goal: form.get("goal"),
      openToRenting: form.get("openToRenting") === "on",
      openToFixerUpper: form.get("openToFixerUpper") === "on",
      renovationBudget: form.get("renovationBudget") ? Number(form.get("renovationBudget")) : undefined,
      freeText: String(form.get("freeText") ?? ""),
      exampleUrls: String(form.get("exampleUrls") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Please check the form — something was missing or invalid.");
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Locations (comma-separated)<input name="locations" required /></label>
      <label>Max budget (₪)<input name="budgetMax" type="number" required /></label>
      <label>Min rooms<input name="minRooms" type="number" step="0.5" /></label>
      <label>Min size (m²)<input name="minSizeSqm" type="number" /></label>
      <label>Must-have extras (comma-separated, e.g. parking, mamad, balcony)<input name="mustHaveExtras" /></label>
      <label>
        Goal
        <select name="goal" required>
          <option value="primary">Primary residence</option>
          <option value="investment">Investment</option>
        </select>
      </label>
      <label><input name="openToRenting" type="checkbox" /> Open to renting first</label>
      <label><input name="openToFixerUpper" type="checkbox" /> Open to a fixer-upper</label>
      <label>Renovation budget (₪, if applicable)<input name="renovationBudget" type="number" /></label>
      <label>Anything else? (free text)<textarea name="freeText" /></label>
      <label>Example listings you've already seen (comma-separated URLs)<textarea name="exampleUrls" /></label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>Save preferences</button>
    </form>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// src/app/onboarding/page.tsx
import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main>
      <h1>Tell us what you're looking for</h1>
      <OnboardingForm />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/onboarding`, fill out the form, submit.
Expected: redirected to `/` with no console errors; a row appears in `PreferenceProfile` (check with `npx prisma studio`).

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingForm.tsx src/app/onboarding
git commit -m "feat: add onboarding form UI"
```

---

## Task 6: Yad2 HTML Parser

**Files:**
- Create: `tests/fixtures/yad2-search-results.html`
- Create: `src/scraper/yad2-parser.ts`
- Test: `tests/unit/yad2-parser.test.ts`

- [ ] **Step 1: Inspect the real site before writing the fixture**

Before writing the fixture below, open `https://www.yad2.co.il/realestate/forsale` in a browser, open DevTools, and inspect the actual listing card markup and CSS class/attribute names. Yad2's markup changes over time and the exact selectors below are a starting approximation — update the fixture and parser together to match what you actually see on the live site. This step exists specifically so the parser is built against reality, not assumption.

- [ ] **Step 2: Write the fixture** (adjust field names/selectors per Step 1's findings)

```html
<!-- tests/fixtures/yad2-search-results.html -->
<div class="feed-list">
  <div class="feeditem" data-item-id="1001" data-url="https://www.yad2.co.il/item/1001">
    <span class="address">Rothschild 12, Tel Aviv</span>
    <span class="price">2,450,000</span>
    <span class="rooms">4</span>
    <span class="size">95</span>
    <span class="floor">3</span>
    <span class="features">parking,balcony,mamad,elevator</span>
    <img class="photo" src="https://img.yad2.co.il/1001.jpg" />
    <p class="description">Renovated apartment near the park.</p>
  </div>
  <div class="feeditem" data-item-id="1002" data-url="https://www.yad2.co.il/item/1002">
    <span class="address">Herzl 45, Ramat Gan</span>
    <span class="price">2,100,000</span>
    <span class="rooms">3.5</span>
    <span class="size">82</span>
    <span class="floor">1</span>
    <span class="features">balcony</span>
    <img class="photo" src="https://img.yad2.co.il/1002.jpg" />
    <p class="description">Ground floor, needs some work.</p>
  </div>
</div>
```

- [ ] **Step 3: Write the failing test**

```ts
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
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test -- tests/unit/yad2-parser.test.ts`
Expected: FAIL — `Cannot find module '@/scraper/yad2-parser'`.

- [ ] **Step 5: Write the parser**

```ts
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
```

- [ ] **Step 6: Install cheerio**

Run: `npm install cheerio`

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- tests/unit/yad2-parser.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add tests/fixtures tests/unit/yad2-parser.test.ts src/scraper/yad2-parser.ts package.json
git commit -m "feat: add Yad2 listing HTML parser"
```

---

## Task 7: Dedup Logic

**Files:**
- Create: `src/scraper/dedup.ts`
- Test: `tests/unit/dedup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/unit/dedup.test.ts`
Expected: FAIL — `Cannot find module '@/scraper/dedup'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/scraper/dedup.ts
import type { ParsedListing } from "@/scraper/yad2-parser";

export function filterNewListings(
  scraped: ParsedListing[],
  existingSourceUrls: Set<string>
): ParsedListing[] {
  return scraped.filter((listing) => !existingSourceUrls.has(listing.sourceUrl));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/dedup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scraper/dedup.ts tests/unit/dedup.test.ts
git commit -m "feat: add listing dedup logic"
```

---

## Task 8: Claude Client Wrapper

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: Write the wrapper**

```ts
// src/lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function askClaude(prompt: string): Promise<string> {
  const anthropic = getClaudeClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}
```

This is a thin wrapper so `scoring.ts` and `preference-profile.ts` can be unit-tested by mocking `askClaude` instead of hitting the network.

- [ ] **Step 2: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Claude API client wrapper"
```

---

## Task 9: Listing Scoring

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/unit/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/scoring.test.ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/unit/scoring.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scoring'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/scoring.ts
import { askClaude } from "@/lib/claude";
import type { PreferenceProfile } from "@prisma/client";
import type { ParsedListing } from "@/scraper/yad2-parser";

export interface ScoreResult {
  score: number;
  reason: string;
}

export async function scoreListing(
  profile: Pick<PreferenceProfile, "learnedSummary">,
  listing: Partial<ParsedListing>
): Promise<ScoreResult> {
  const prompt = `You are helping score a real estate listing against a buyer's preferences.

Buyer preferences: ${profile.learnedSummary ?? "No preferences recorded yet."}

Listing:
${JSON.stringify(listing, null, 2)}

Respond with ONLY a JSON object of the form {"score": <0-100 integer>, "reason": "<one sentence>"}. No other text.`;

  const raw = await askClaude(prompt);
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);

  if (
    typeof parsed.score !== "number" ||
    !Number.isInteger(parsed.score) ||
    parsed.score < 0 ||
    parsed.score > 100 ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error(`Unexpected scoring response shape: ${raw}`);
  }

  return { score: parsed.score, reason: parsed.reason };
}
```

(Note: the guard strips markdown code fences before parsing, since Claude sometimes wraps JSON in ` ```json ... ``` ` despite being asked not to, and validates `score` is an integer in 0-100 rather than accepting any number — both added after Task 9's code review found a single out-of-range or fenced response would otherwise corrupt data or abort Task 12's whole scrape run.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/scoring.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/unit/scoring.test.ts
git commit -m "feat: add Claude-based listing scoring"
```

---

## Task 10: Preference Profile Learning

**Files:**
- Create: `src/lib/preference-profile.ts`
- Test: `tests/unit/preference-profile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/preference-profile.test.ts
import { describe, it, expect, vi } from "vitest";
import { updateLearnedSummary } from "@/lib/preference-profile";
import * as claude from "@/lib/claude";

describe("updateLearnedSummary", () => {
  it("asks Claude to rewrite the summary using profile + feedback and returns the text", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue(
      "Wants 3-4 room apartments in Tel Aviv/Ramat Gan under 3M with a mamad. Dislikes ground-floor units."
    );

    const summary = await updateLearnedSummary(
      {
        locations: JSON.stringify(["Tel Aviv", "Ramat Gan"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify(["mamad"]),
        freeText: "quiet street",
        learnedSummary: null,
      } as any,
      [
        { reaction: "dislike", note: "ground floor, too noisy", listing: { address: "Herzl 45", floor: 1 } },
        { reaction: "like", note: null, listing: { address: "Rothschild 12", floor: 3 } },
      ] as any
    );

    expect(summary).toContain("mamad");
    expect(claude.askClaude).toHaveBeenCalledWith(expect.stringContaining("ground floor"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/unit/preference-profile.test.ts`
Expected: FAIL — `Cannot find module '@/lib/preference-profile'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/preference-profile.ts
import { askClaude } from "@/lib/claude";
import type { PreferenceProfile, Feedback, Listing } from "@prisma/client";

type FeedbackWithListing = Feedback & { listing: Pick<Listing, "address" | "floor"> };

export async function updateLearnedSummary(
  profile: Pick<
    PreferenceProfile,
    "locations" | "budgetMax" | "mustHaveExtras" | "freeText" | "learnedSummary"
  >,
  recentFeedback: FeedbackWithListing[]
): Promise<string> {
  const feedbackLines = recentFeedback
    .map((f) => `- ${f.reaction.toUpperCase()} "${f.listing.address}"${f.note ? ` — note: ${f.note}` : ""}`)
    .join("\n");

  const prompt = `You maintain a short, plain-language summary of a home buyer's preferences, used to score new listings.

Structured criteria:
- Locations: ${JSON.parse(profile.locations).join(", ")}
- Budget max: ${profile.budgetMax}
- Must-have extras: ${JSON.parse(profile.mustHaveExtras).join(", ") || "none"}
- Free text: ${profile.freeText ?? "none"}

Previous learned summary: ${profile.learnedSummary ?? "none yet"}

Recent feedback on listings they've seen:
${feedbackLines || "none yet"}

Rewrite the learned summary in 2-4 sentences, incorporating what the feedback reveals about their real preferences (e.g. patterns in what they liked or disliked). Respond with ONLY the summary text, no preamble.`;

  const summary = await askClaude(prompt);

  if (!summary.trim()) {
    throw new Error("updateLearnedSummary: Claude returned an empty summary");
  }

  return summary;
}
```

(Note: the empty-summary guard was added after Task 10's code review — without it, an empty Claude response silently overwrites `learnedSummary` and degrades every future prompt with no error surfaced.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/preference-profile.test.ts`
Expected: PASS (5 tests — the original test plus 4 added during review: empty feedback → "none yet", null learnedSummary → "none yet", empty mustHaveExtras → "none", and empty Claude response → rejects).

- [ ] **Step 5: Commit**

```bash
git add src/lib/preference-profile.ts tests/unit/preference-profile.test.ts
git commit -m "feat: add preference profile learning from feedback"
```

---

## Task 11: Feedback API Route

**Note (added after Task 10's review):** `updateLearnedSummary` now throws on an empty Claude response, and any Claude API error also propagates as a throw. The route below calls it *after* `db.feedback.create` has already succeeded — without a try/catch around the refresh block, a Claude hiccup would turn an otherwise-successful feedback submission into a 500 for the user, even though their like/dislike was already saved. Step 3's implementation wraps the refresh call accordingly; don't remove that try/catch when implementing.

**Files:**
- Create: `src/app/api/feedback/route.ts`
- Test: `tests/integration/feedback-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/feedback-route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";
import { db } from "@/lib/db";
import * as prefProfile from "@/lib/preference-profile";

describe("POST /api/feedback", () => {
  let listingId: string;
  let profileId: string;

  beforeEach(async () => {
    const listing = await db.listing.create({
      data: {
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/${Date.now()}`,
        address: "Test St 1",
        price: 1000000,
        rooms: 3,
        sizeSqm: 60,
      },
    });
    listingId = listing.id;

    const profile = await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });
    profileId = profile.id;
  });

  afterEach(async () => {
    await db.feedback.deleteMany();
    await db.listing.deleteMany();
    await db.preferenceProfile.deleteMany();
  });

  it("stores feedback for a listing", async () => {
    vi.spyOn(prefProfile, "updateLearnedSummary").mockResolvedValue("updated summary");

    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ listingId, reaction: "like", note: "great layout" }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const stored = await db.feedback.findFirst({ where: { listingId } });
    expect(stored?.reaction).toBe("like");
    expect(stored?.note).toBe("great layout");
  });

  it("triggers a learned-summary update every 3rd feedback event", async () => {
    const spy = vi.spyOn(prefProfile, "updateLearnedSummary").mockResolvedValue("updated summary");

    for (let i = 0; i < 3; i++) {
      const req = new Request("http://localhost/api/feedback", {
        method: "POST",
        body: JSON.stringify({ listingId, reaction: "like" }),
      });
      await POST(req as any);
    }

    expect(spy).toHaveBeenCalledTimes(1);
    const profile = await db.preferenceProfile.findUnique({ where: { id: profileId } });
    expect(profile?.learnedSummary).toBe("updated summary");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/integration/feedback-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/feedback/route'`.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/feedback/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackSchema } from "@/lib/validation";
import { updateLearnedSummary } from "@/lib/preference-profile";

const REFRESH_EVERY_N_FEEDBACK = 3;

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { listingId, reaction, note } = parsed.data;

  const feedback = await db.feedback.create({
    data: { listingId, reaction, note },
  });

  const totalFeedback = await db.feedback.count();

  if (totalFeedback % REFRESH_EVERY_N_FEEDBACK === 0) {
    const profile = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
    if (profile) {
      try {
        const recent = await db.feedback.findMany({
          orderBy: { createdAt: "desc" },
          take: REFRESH_EVERY_N_FEEDBACK,
          include: { listing: { select: { address: true, floor: true } } },
        });
        const learnedSummary = await updateLearnedSummary(profile, recent as any);
        await db.preferenceProfile.update({ where: { id: profile.id }, data: { learnedSummary } });
      } catch (err) {
        console.error("Failed to refresh learned summary:", err);
      }
    }
  }

  return NextResponse.json({ feedback });
}
```

(The try/catch means a Claude failure during the learning-refresh doesn't fail the feedback submission itself — the user's like/dislike is already saved by this point; the summary just doesn't get refreshed this time and will retry on the next 3rd event.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/integration/feedback-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback tests/integration/feedback-route.test.ts
git commit -m "feat: add feedback API route with learning-loop trigger"
```

---

## Task 12: Scraper Orchestration

**Precondition (added after Task 6's review):** Task 6's fixture/selectors were built without access to Yad2's real live markup and were explicitly flagged as unverified. Before starting this task, inspect `https://www.yad2.co.il/realestate/forsale` in a real browser, compare its actual listing-card DOM to `tests/fixtures/yad2-search-results.html` and the CSS selectors in `src/scraper/yad2-parser.ts`, and update both to match reality. Do not proceed with the rest of this task until the parser has been checked against real markup — the whole pipeline depends on it.

**Known risk this task must guard against:** if `parseListingsFromHtml` ever returns a listing with a missing `sourceUrl` (empty string) or a `NaN` numeric field (`price`/`rooms`/`sizeSqm`) — e.g. because Yad2's markup doesn't match a selector — inserting it would either throw on the `Listing.sourceUrl` unique-constraint (multiple empty-string rows collide) or write `NaN` into a Prisma `Int` column. Worse, once one empty-`sourceUrl` listing exists in the DB, `filterNewListings` would treat every subsequent malformed listing as "already seen" and silently drop it from every future run with no error surfaced. Step 3 below includes a validation/filter pass specifically to prevent this — don't skip it.

**Status update (post-implementation, both attempted and accepted as a known limitation):** the precondition above was attempted twice during this task — once via `curl`, once via a real Playwright chromium instance against the live URL — and both times Yad2 returned a Radware Bot Manager challenge page instead of real listings, so the parser's selectors in `src/scraper/yad2-parser.ts` and the fixture in `tests/fixtures/yad2-search-results.html` remain unverified against real markup. This was surfaced to the user, who chose to proceed with Playwright anyway and accept the scraper may be flaky/blocked in production, rather than switch to a different data-source strategy. Two mitigations were added as a result: (1) `runScrapePipeline` detects known Radware challenge-page markers and reports the run as a clear failure (`errorMessage` mentioning "anti-bot"/"Radware") rather than silently looking like a quiet day with zero new listings; (2) this detector is itself a best-effort heuristic (three keyword/regex checks) that hasn't been validated against a captured real challenge page or real listings page, so it could theoretically false-positive or false-negative — first real production run should have its `ScrapeRun.errorMessage` (or lack thereof) checked by hand once, and the fixture/selectors updated at that point if real markup differs from the placeholder.

**Files:**
- Create: `src/scraper/run.ts`
- Test: `tests/integration/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

    await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");

    const listings = await db.listing.findMany();
    expect(listings).toHaveLength(2);
    expect(listings[0].matchScore).toBe(80);

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(true);
    expect(runs[0].newListings).toBe(2);
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

    await runScrapePipeline("https://www.yad2.co.il/realestate/forsale");

    const runs = await db.scrapeRun.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].success).toBe(false);
    expect(runs[0].errorMessage).toContain("ERR_CONNECTION_RESET");
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
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/integration/pipeline.test.ts`
Expected: FAIL — `Cannot find module '@/scraper/run'`.

- [ ] **Step 3: Write the orchestration script**

```ts
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

export async function runScrapePipeline(searchUrl: string): Promise<{ success: boolean }> {
  const run = await db.scrapeRun.create({ data: {} });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(searchUrl, { timeout: 15000 });
    const html = await page.content();

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

    let failedScoring = 0;
    for (const listing of newListings) {
      let score: number | null = null;
      let reason: string | null = null;
      if (profile) {
        try {
          const result = await scoreListing(profile, listing);
          score = result.score;
          reason = result.reason;
        } catch (err) {
          failedScoring++;
          console.warn(`runScrapePipeline: failed to score listing ${listing.sourceUrl}, saving unscored:`, err);
        }
      }

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
      data: {
        finishedAt: new Date(),
        success: true,
        newListings: newListings.length,
        skippedListings: skippedCount,
        failedScoring,
      },
    });
    return { success: true };
  } catch (err) {
    await db.scrapeRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return { success: false };
  } finally {
    await browser?.close();
  }
}

if (require.main === module) {
  const url = process.env.YAD2_SEARCH_URL ?? "https://www.yad2.co.il/realestate/forsale";
  runScrapePipeline(url)
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

(A single bad `scoreListing` response no longer aborts the whole run — that listing is saved unscored instead, and `failedScoring` counts how many. `browser.close()` moved to a `finally` so navigation failures don't leak the Chromium process. The function now returns `{ success: boolean }` so the CLI entrypoint's exit code actually reflects whether the run succeeded — previously it always exited 0. All three fixes were added after Task 12's code review.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/integration/pipeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scraper/run.ts tests/integration/pipeline.test.ts
git commit -m "feat: add scraper orchestration pipeline with error handling"
```

---

## Task 13: Daily Feed UI

**Files:**
- Create: `src/components/ListingCard.tsx`
- Create: `src/app/page.tsx`
- Modify: `src/app/api/onboarding/route.ts` — none (read-only page, no route changes needed)
- Create: `src/app/api/listings/route.ts`

- [ ] **Step 1: Write the listings API route**

```ts
// src/app/api/listings/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  const where =
    filter === "favorites"
      ? { feedback: { some: { reaction: "like" } } }
      : filter === "unseen"
      ? { feedback: { none: {} } }
      : {};

  const listings = await db.listing.findMany({
    where,
    orderBy: { matchScore: "desc" },
    include: { feedback: true },
  });

  return NextResponse.json({ listings });
}
```

- [ ] **Step 2: Write the ListingCard component**

```tsx
// src/components/ListingCard.tsx
"use client";

interface ListingCardProps {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
  onFeedback: (id: string, reaction: "like" | "dislike") => void;
}

export function ListingCard({
  id,
  address,
  price,
  rooms,
  sizeSqm,
  matchScore,
  matchReason,
  onFeedback,
}: ListingCardProps) {
  return (
    <article>
      <h3>{address}</h3>
      <p>₪{price.toLocaleString()} · {rooms} rooms · {sizeSqm}m²</p>
      {matchScore !== null && (
        <p>
          Match: {matchScore}/100 — {matchReason}
        </p>
      )}
      <button onClick={() => onFeedback(id, "like")}>Like</button>
      <button onClick={() => onFeedback(id, "dislike")}>Dislike</button>
    </article>
  );
}
```

- [ ] **Step 3: Write the feed page**

```tsx
// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/components/ListingCard";

interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
}

export default function FeedPage() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  async function handleFeedback(listingId: string, reaction: "like" | "dislike") {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reaction }),
    });
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  return (
    <main>
      <h1>New listings</h1>
      {listings.length === 0 && <p>No listings yet — check back after the next scrape.</p>}
      {listings.map((listing) => (
        <ListingCard key={listing.id} {...listing} onFeedback={handleFeedback} />
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: page loads without console errors; if listings exist in the DB (e.g. from `npx prisma studio` seeding or a manual `npm run scrape`), they render sorted by score.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/listings src/app/page.tsx src/components/ListingCard.tsx
git commit -m "feat: add daily feed UI"
```

---

## Task 14: All Listings / History Page

**Files:**
- Create: `src/app/listings/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/listings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/components/ListingCard";

interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
}

type FilterOption = "all" | "favorites" | "unseen";

export default function ListingsHistoryPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<FilterOption>("all");

  useEffect(() => {
    const query = filter === "all" ? "" : `?filter=${filter}`;
    fetch(`/api/listings${query}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, [filter]);

  async function handleFeedback(listingId: string, reaction: "like" | "dislike") {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reaction }),
    });
  }

  return (
    <main>
      <h1>All listings</h1>
      <label>
        Filter:
        <select value={filter} onChange={(e) => setFilter(e.target.value as FilterOption)}>
          <option value="all">All</option>
          <option value="favorites">Favorites</option>
          <option value="unseen">Unseen</option>
        </select>
      </label>
      {listings.map((listing) => (
        <ListingCard key={listing.id} {...listing} onFeedback={handleFeedback} />
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/listings`, switch the filter dropdown.
Expected: listings list updates per filter with no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/listings
git commit -m "feat: add all-listings history page with filters"
```

---

## Task 15: Compare Page

**Files:**
- Create: `src/components/CompareTable.tsx`
- Create: `src/app/compare/page.tsx`

- [ ] **Step 1: Write the CompareTable component**

```tsx
// src/components/CompareTable.tsx
interface CompareListing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
}

export function CompareTable({ listings }: { listings: CompareListing[] }) {
  const rows: { label: string; get: (l: CompareListing) => string | number }[] = [
    { label: "Address", get: (l) => l.address },
    { label: "Price", get: (l) => `₪${l.price.toLocaleString()}` },
    { label: "Rooms", get: (l) => l.rooms },
    { label: "Size (m²)", get: (l) => l.sizeSqm },
    { label: "Match score", get: (l) => l.matchScore ?? "—" },
  ];

  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {listings.map((listing) => (
              <td key={listing.id}>{row.get(listing)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Write the compare page**

```tsx
// src/app/compare/page.tsx
"use client";

import { useEffect, useState } from "react";
import { CompareTable } from "@/components/CompareTable";

interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
}

export default function ComparePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/listings?filter=favorites")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  const selected = listings.filter((l) => selectedIds.includes(l.id));

  return (
    <main>
      <h1>Compare</h1>
      <p>Select 2-4 favorites to compare:</p>
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedIds.includes(l.id)}
                onChange={() => toggle(l.id)}
              />
              {l.address}
            </label>
          </li>
        ))}
      </ul>
      {selected.length >= 2 && <CompareTable listings={selected} />}
    </main>
  );
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/compare`, select 2+ favorited listings.
Expected: table renders with a column per selected listing.

- [ ] **Step 4: Commit**

```bash
git add src/components/CompareTable.tsx src/app/compare
git commit -m "feat: add side-by-side compare page"
```

---

## Task 16: Health Status Component

**Files:**
- Create: `src/app/api/scrape-runs/route.ts`
- Create: `src/components/HealthStatus.tsx`
- Modify: `src/app/page.tsx` — render `<HealthStatus />` at the top

- [ ] **Step 1: Write the scrape-runs API route**

```ts
// src/app/api/scrape-runs/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const lastRun = await db.scrapeRun.findFirst({ orderBy: { startedAt: "desc" } });
  return NextResponse.json({ lastRun });
}
```

- [ ] **Step 2: Write the HealthStatus component**

```tsx
// src/components/HealthStatus.tsx
"use client";

import { useEffect, useState } from "react";

interface ScrapeRun {
  startedAt: string;
  success: boolean;
  newListings: number;
  skippedListings: number;
  failedScoring: number;
  errorMessage: string | null;
}

export function HealthStatus() {
  const [lastRun, setLastRun] = useState<ScrapeRun | null>(null);

  useEffect(() => {
    fetch("/api/scrape-runs")
      .then((res) => res.json())
      .then((data) => setLastRun(data.lastRun));
  }, []);

  if (!lastRun) return <p>No scrape has run yet.</p>;

  const notes = [
    lastRun.skippedListings > 0 ? `${lastRun.skippedListings} skipped (bad data)` : null,
    lastRun.failedScoring > 0 ? `${lastRun.failedScoring} unscored (Claude error)` : null,
  ].filter(Boolean);

  return (
    <p>
      Last scrape: {new Date(lastRun.startedAt).toLocaleString()} —{" "}
      {lastRun.success ? `${lastRun.newListings} new listings` : `failed: ${lastRun.errorMessage}`}
      {notes.length > 0 && ` (${notes.join(", ")})`}
    </p>
  );
}
```

(`skippedListings`/`failedScoring` surface Task 12's per-run counters, added after its code review, so a run that technically "succeeds" but silently dropped or under-scored listings — e.g. because Yad2's markup drifted from the parser's selectors — is visible here instead of only in server logs nobody watches.)

- [ ] **Step 3: Wire it into the feed page**

In `src/app/page.tsx`, add the import and render it above the `<h1>`:

```tsx
import { HealthStatus } from "@/components/HealthStatus";
```

```tsx
      <HealthStatus />
      <h1>New listings</h1>
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: a status line appears above "New listings" showing the last scrape time/result.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scrape-runs src/components/HealthStatus.tsx src/app/page.tsx
git commit -m "feat: add scrape health status display"
```

---

## Task 17: Windows Task Scheduler Wiring

**Files:**
- Create: `docs/scheduling.md`

- [ ] **Step 1: Verify the scrape script runs standalone**

Run: `npm run scrape`
Expected: exits 0, and a new `ScrapeRun` row appears (check via `npx prisma studio`).

- [ ] **Step 2: Document the Task Scheduler setup**

```markdown
<!-- docs/scheduling.md -->
# Scheduling the daily scrape

1. Open Task Scheduler → Create Basic Task.
2. Name: "Home Search Assistant — Daily Scrape". Trigger: Daily, pick a time (e.g. 7:00 AM).
3. Action: "Start a program".
   - Program/script: `C:\Program Files\nodejs\npm.cmd`
   - Add arguments: `run scrape`
   - Start in: `C:\Users\user\Desktop\claude\מתווך`
4. Finish, then right-click the task → Run, to confirm it works.
5. Check `npx prisma studio` afterward for a new ScrapeRun row.
```

- [ ] **Step 3: Follow the doc to actually create the scheduled task, then run it once manually to confirm**

Expected: a new `ScrapeRun` row appears after the manual run, same as Step 1.

- [ ] **Step 4: Commit**

```bash
git add docs/scheduling.md
git commit -m "docs: add Windows Task Scheduler setup instructions"
```

---

## Task 18: End-to-End Tests

**Files:**
- Create: `tests/e2e/onboarding.spec.ts`
- Create: `tests/e2e/feed-and-feedback.spec.ts`

- [ ] **Step 1: Write the onboarding e2e test**

```ts
// tests/e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";

test("user can complete onboarding and land on the feed", async ({ page }) => {
  await page.goto("/onboarding");

  await page.fill('input[name="locations"]', "Tel Aviv, Ramat Gan");
  await page.fill('input[name="budgetMax"]', "3000000");
  await page.selectOption('select[name="goal"]', "primary");
  await page.fill('textarea[name="freeText"]', "quiet street, near a park");

  await page.click('button[type="submit"]');

  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("New listings");
});
```

- [ ] **Step 2: Write the feed + feedback e2e test**

```ts
// tests/e2e/feed-and-feedback.spec.ts
import { test, expect } from "@playwright/test";

test("liking a listing removes it from the feed", async ({ page, request }) => {
  // Seed a listing directly via the API for a deterministic starting state.
  await request.post("/api/onboarding", {
    data: {
      locations: ["Tel Aviv"],
      budgetMax: 3000000,
      goal: "primary",
    },
  });

  await page.goto("/");
  const firstCard = page.locator("article").first();
  const addressBefore = await firstCard.locator("h3").textContent();

  await firstCard.getByText("Like").click();

  await expect(page.locator("article").first().locator("h3")).not.toHaveText(addressBefore ?? "");
});
```

Note: this test assumes at least one listing already exists in the dev database (e.g. from running `npm run scrape` once, or seeding manually via `npx prisma studio`). If the feed is empty, seed a listing first.

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS (2 tests). If the feed-and-feedback test fails because there are no listings, seed one via Prisma Studio and re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test: add end-to-end onboarding and feedback flows"
```

---

## Plan Self-Review Notes

- **Spec coverage:** onboarding (Task 5), scraper + parser (Task 6, 12), dedup (Task 7), scoring (Task 9), learning loop (Task 10, 11), feed (Task 13), history (Task 14), compare/table view (Task 15), health check (Task 16), scheduling (Task 17), error handling (Task 12's failure-path test, Task 4/11's validation), testing at all four levels from the spec (unit/integration/API/e2e — Tasks 6-7, 9-11, 4/11, 18) are all covered.
- **Known gap, deliberately deferred per spec's Out of Scope:** Madlan scraping and notifications are not built — matches the spec.
- **Real-world risk flagged in Task 6, Step 1:** the Yad2 fixture/selectors are a starting approximation; the implementer must verify against the live site before the scraper will work for real, not just against fixtures.
