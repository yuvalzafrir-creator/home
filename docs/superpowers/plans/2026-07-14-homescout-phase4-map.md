# HomeScout Map View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show listings on a map — a dedicated `/map` page, a list⇄map toggle on `/listings`, and a small map on the detail page — backed by free Nominatim geocoding.

**Architecture:** Add nullable `lat`/`lng` to `Listing`. A `geocode.ts` lib resolves an address → coords via Nominatim (OpenStreetMap, no API key). Listings are geocoded on manual add and via a one-off backfill script. A client-only `ListingsMap` component renders raw Leaflet (dynamically imported inside `useEffect` so it never touches SSR) with circle markers + popups; a stacking-context wrapper keeps Leaflet's high z-indexes below the sticky header.

**Tech Stack:** Next.js 14 (App Router), React 18, Prisma + SQLite, Leaflet (new dep), Nominatim, Zod, Vitest, Playwright.

**Scope note:** From the approved redesign spec (`docs/superpowers/specs/2026-07-13-homescout-redesign-design.md`, the map phase). Builds on Phases 1–3 (merged). The AI copilot is the remaining phase after this.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `prisma/schema.prisma` | Add `lat`/`lng` to `Listing` | Modify |
| `src/lib/geocode.ts` | Address → `{lat,lng}` via Nominatim | Create |
| `src/app/api/listings/route.ts` | Geocode on create | Modify |
| `src/scraper/geocode-backfill.ts` | Backfill coords for existing rows | Create |
| `package.json` | `geocode` script + leaflet dep | Modify |
| `src/types/listing.ts` | Add `lat`/`lng` | Modify |
| `src/components/ListingsMap.tsx` | Leaflet map (client) | Create |
| `src/app/globals.css` | Map container + stacking + toggle styles | Modify |
| `src/app/map/page.tsx` | `/map` page (gated) | Create |
| `src/components/Header.tsx` | "מפה" nav item | Modify |
| `src/app/listings/ListingsClient.tsx` | list⇄map toggle | Modify |
| `src/app/listings/[id]/page.tsx` | Map on detail page | Modify |
| `tests/unit/geocode.test.ts` | Geocode parsing | Create |
| `tests/integration/listings-create-route.test.ts` | Mock geocode | Modify |
| `tests/e2e/map.spec.ts` | Map page renders | Create |

---

## Task 1: Add `lat`/`lng` columns

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1:** In `model Listing`, add after the `neighborhood String?` line:

```prisma
  lat          Float?
  lng          Float?
```

- [ ] **Step 2:** Run `npx prisma migrate dev --name add_listing_lat_lng` (nullable columns — no data loss; if it wants to reset, STOP and report BLOCKED).
- [ ] **Step 3:** Run `DATABASE_URL="file:./test.db" npx prisma migrate deploy`.
- [ ] **Step 4:** Confirm the generated `migration.sql` only `ADD COLUMN`s (report its contents).
- [ ] **Step 5:** Commit:

```bash
git add prisma/schema.prisma prisma/migrations
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: add lat/lng columns to Listing"
```

---

## Task 2: Geocoding lib

**Files:** Create `src/lib/geocode.ts`, `tests/unit/geocode.test.ts`

- [ ] **Step 1: Write the failing test** `tests/unit/geocode.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress } from "@/lib/geocode";

afterEach(() => vi.unstubAllGlobals());

describe("geocodeAddress", () => {
  it("returns parsed coords from a Nominatim hit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify([{ lat: "32.0853", lon: "34.7818" }]), { status: 200 })
    ));
    const res = await geocodeAddress("Rothschild 1, Tel Aviv");
    expect(res).toEqual({ lat: 32.0853, lng: 34.7818 });
  });

  it("returns null when Nominatim finds nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    expect(await geocodeAddress("nowhere at all")).toBeNull();
  });

  it("returns null on a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await geocodeAddress("x")).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npx vitest run tests/unit/geocode.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/geocode.ts`:

```ts
export interface GeoResult {
  lat: number;
  lng: number;
}

// Free OpenStreetMap geocoder — no API key. Usage policy asks for a descriptive
// User-Agent and <=1 req/sec (the backfill script paces itself; single ad-hoc
// calls are fine).
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HomeScout/1.0 (personal home-search tool)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { lat?: string; lon?: string };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4:** Run `npx vitest run tests/unit/geocode.test.ts` → PASS (3). `npx tsc --noEmit` → clean.
- [ ] **Step 5:** Commit:

```bash
git add src/lib/geocode.ts tests/unit/geocode.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: Nominatim geocoding lib"
```

---

## Task 3: Geocode on add + backfill script

**Files:** Modify `src/app/api/listings/route.ts`, `tests/integration/listings-create-route.test.ts`, `package.json`; Create `src/scraper/geocode-backfill.ts`

- [ ] **Step 1: Mock geocode in the existing create test**

The create route will call `geocodeAddress` (network). Add a mock at the top of `tests/integration/listings-create-route.test.ts`, right after the existing `vi.mock("@/lib/scoring", ...)` block:

```ts
vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(async () => ({ lat: 32.08, lng: 34.78 })),
}));
```

And add an assertion to the existing "creates a listing…" test (after the `matchScore` expect):

```ts
    expect(body.listing.lat).toBe(32.08);
    expect(body.listing.lng).toBe(34.78);
```

- [ ] **Step 2: Geocode inside `POST /api/listings`**

In `src/app/api/listings/route.ts`, add the import:

```ts
import { geocodeAddress } from "@/lib/geocode";
```

After the scoring block and before the `db.listing.create(...)` call, add a best-effort geocode:

```ts
  // Best-effort geocode for the map — a miss/failure leaves lat/lng null.
  const geo = await geocodeAddress(data.address);
```

Then in the `create({ data: { … } })` object, add (next to the other fields):

```ts
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
```

- [ ] **Step 3: Backfill script** `src/scraper/geocode-backfill.ts`:

```ts
// One-off: geocode existing listings that have no coordinates yet.
// Run: npx tsx src/scraper/geocode-backfill.ts
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";

async function main() {
  const listings = await db.listing.findMany({ where: { lat: null } });
  console.log(`Geocoding ${listings.length} listing(s)…`);
  for (const l of listings) {
    const geo = await geocodeAddress(l.address);
    if (geo) {
      await db.listing.update({ where: { id: l.id }, data: { lat: geo.lat, lng: geo.lng } });
      console.log(`  ✓ ${l.address} → ${geo.lat},${geo.lng}`);
    } else {
      console.warn(`  ✗ ${l.address} — no result`);
    }
    // Respect Nominatim's ~1 req/sec usage policy.
    await new Promise((r) => setTimeout(r, 1100));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 4: Add the npm script**

In `package.json` `"scripts"`, add:

```json
    "geocode": "tsx src/scraper/geocode-backfill.ts",
```

- [ ] **Step 5:** Run `npx vitest run tests/integration/listings-create-route.test.ts` → PASS. `npx tsc --noEmit` → clean. (Do NOT run the live backfill here — it hits the network; it's a manual op.)
- [ ] **Step 6:** Commit:

```bash
git add src/app/api/listings/route.ts src/scraper/geocode-backfill.ts package.json tests/integration/listings-create-route.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: geocode listings on add + backfill script"
```

---

## Task 4: `ListingsMap` component (+ Leaflet dep)

**Files:** Create `src/components/ListingsMap.tsx`; Modify `src/types/listing.ts`, `src/app/globals.css`, `package.json`

- [ ] **Step 1: Install Leaflet**

Run: `npm install leaflet@^1.9.4 && npm install -D @types/leaflet@^1.9.12`
(Confirm `leaflet` lands in `dependencies` and `@types/leaflet` in `devDependencies`.)

- [ ] **Step 2: Extend the Listing type** (`src/types/listing.ts`) — add two fields:

```ts
  lat: number | null;
  lng: number | null;
```

- [ ] **Step 3: Create `src/components/ListingsMap.tsx`:**

```tsx
"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapListing {
  id: string;
  address: string;
  price: number;
  lat: number;
  lng: number;
  matchScore: number | null;
}

export function ListingsMap({ listings, height = 420 }: { listings: MapListing[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || listings.length === 0) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const points: [number, number][] = [];
      for (const l of listings) {
        const score = l.matchScore !== null ? ` · ${l.matchScore}/100` : "";
        L.circleMarker([l.lat, l.lng], {
          radius: 9,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.85,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(
            `<div dir="rtl" style="font-size:13px"><strong>${l.address}</strong><br/>₪${l.price.toLocaleString()}${score}<br/><a href="/listings/${l.id}">לפרטים ←</a></div>`
          );
        points.push([l.lat, l.lng]);
      }

      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(points, { padding: [30, 30] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [listings]);

  if (listings.length === 0) {
    return <div className="empty">אין מודעות עם מיקום להצגה על המפה.</div>;
  }

  return <div ref={ref} className="map-container" style={{ height }} />;
}
```

- [ ] **Step 4: Styles** — append to `src/app/globals.css`:

```css
.map-container {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  /* Own stacking context so Leaflet's high internal z-indexes stay below the
     sticky header (z-index 20). */
  position: relative;
  z-index: 0;
}
```

- [ ] **Step 5:** Run `npx tsc --noEmit` → clean.
- [ ] **Step 6:** Commit:

```bash
git add src/components/ListingsMap.tsx src/types/listing.ts src/app/globals.css package.json package-lock.json
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: Leaflet ListingsMap component"
```

---

## Task 5: `/map` page + nav

**Files:** Create `src/app/map/page.tsx`; Modify `src/components/Header.tsx`

- [ ] **Step 1: Create `src/app/map/page.tsx`:**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { ListingsMap, type MapListing } from "@/components/ListingsMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const all = await db.listing.findMany({
    where: { status: "active" },
    orderBy: { matchScore: "desc" },
  });

  const located: MapListing[] = all
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({ id: l.id, address: l.address, price: l.price, lat: l.lat!, lng: l.lng!, matchScore: l.matchScore }));
  const unlocated = all.filter((l) => l.lat === null || l.lng === null);

  return (
    <main>
      <h1>מפה</h1>
      <p className="page-subtitle">כל המודעות עם מיקום ידוע על המפה.</p>
      <ListingsMap listings={located} />
      {unlocated.length > 0 && (
        <div className="map-unlocated">
          <h2>ללא מיקום ({unlocated.length})</h2>
          <ul>
            {unlocated.map((l) => (
              <li key={l.id}>
                <Link href={`/listings/${l.id}`}>{l.address}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Nav item** — in `src/components/Header.tsx`, insert `{ href: "/map", label: "מפה" }` after the `/listings` entry:

```tsx
const NAV = [
  { href: "/", label: "לוח בקרה" },
  { href: "/listings", label: "מודעות" },
  { href: "/map", label: "מפה" },
  { href: "/compare", label: "השוואה" },
  { href: "/profile", label: "פרופיל" },
  { href: "/add", label: "הוספה" },
];
```

- [ ] **Step 3: Style the unlocated list** — append to `src/app/globals.css`:

```css
.map-unlocated {
  margin-top: 28px;
}
.map-unlocated h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.map-unlocated ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.map-unlocated a {
  color: var(--accent);
  font-size: 14px;
}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` → clean. Run `npx next build 2>&1 | tail -20` → `/map` compiles (dynamic ƒ).
- [ ] **Step 5:** Commit:

```bash
git add src/app/map/page.tsx src/components/Header.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: /map page with pins for located listings"
```

---

## Task 6: list⇄map toggle + detail-page map

**Files:** Modify `src/app/listings/ListingsClient.tsx`, `src/app/listings/[id]/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Add the toggle to `ListingsClient`**

In `src/app/listings/ListingsClient.tsx`:
(a) Add imports:
```tsx
import { useState } from "react";
import { ListingsMap, type MapListing } from "@/components/ListingsMap";
```
(`useState` is likely already imported — if so, don't duplicate it.)

(b) Inside the component, add a view state near the other hooks:
```tsx
  const [view, setView] = useState<"list" | "map">("list");
```

(c) Derive the located listings (place this just before the `return`):
```tsx
  const located: MapListing[] = listings
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({ id: l.id, address: l.address, price: l.price, lat: l.lat as number, lng: l.lng as number, matchScore: l.matchScore }));
```

(d) Add a toggle control right after the `<SourceLinks />` line:
```tsx
      <div className="view-toggle">
        <button data-active={view === "list"} onClick={() => setView("list")}>רשימה</button>
        <button data-active={view === "map"} onClick={() => setView("map")}>מפה</button>
      </div>
```

(e) Wrap the existing list rendering (the `control-row` + the empty/`card-list` block) so it shows only in list view, and render the map in map view. Replace the block that currently starts at `<div className="control-row">` through the closing of the list conditional with:
```tsx
      {view === "map" ? (
        <ListingsMap listings={located} />
      ) : (
        <>
          <div className="control-row">
            <label htmlFor="filter">סינון</label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
            >
              <option value="all">הכל</option>
              <option value="favorites">מועדפים</option>
              <option value="unseen">טרם נצפו</option>
            </select>
          </div>
          {listings.length === 0 ? (
            <div className="empty">אין מודעות שתואמות לסינון עדיין.</div>
          ) : (
            <div className="card-list">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  {...listing}
                  onFeedback={handleFeedback}
                  disabled={pendingIds.has(listing.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
```

- [ ] **Step 2: Map on the detail page**

In `src/app/listings/[id]/page.tsx`, add the import:
```tsx
import { ListingsMap } from "@/components/ListingsMap";
```
Then, right after the amenity-chips `</div>` and before the match-reason section, add a conditional map:
```tsx
      {listing.lat !== null && listing.lng !== null && (
        <div style={{ marginBottom: 28 }}>
          <ListingsMap
            height={220}
            listings={[{ id: listing.id, address: listing.address, price: listing.price, lat: listing.lat, lng: listing.lng, matchScore: listing.matchScore }]}
          />
        </div>
      )}
```

- [ ] **Step 3: Style the toggle** — append to `src/app/globals.css`:

```css
.view-toggle {
  display: inline-flex;
  gap: 4px;
  margin-bottom: 20px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
}
.view-toggle button {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 14px;
  color: var(--text-muted);
}
.view-toggle button[data-active="true"] {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` → clean. Run `npx next build 2>&1 | tail -20` → builds.
- [ ] **Step 5:** Commit:

```bash
git add src/app/listings/ListingsClient.tsx "src/app/listings/[id]/page.tsx" src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: list/map toggle on listings and map on detail page"
```

---

## Task 7: E2E + full suite

**Files:** Create `tests/e2e/map.spec.ts`

- [ ] **Step 1: Create `tests/e2e/map.spec.ts`:**

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/map.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("map page", () => {
  let listingId: string;
  let createdProfileId: string | null = null;

  test.beforeEach(async () => {
    const unique = Date.now();
    const listing = await db.listing.create({
      data: {
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/map-${unique}`,
        address: `Map Test St ${unique}`,
        price: 2500000,
        rooms: 3,
        sizeSqm: 80,
        lat: 32.0853,
        lng: 34.7818,
      },
    });
    listingId = listing.id;

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
    await db.listing.delete({ where: { id: listingId } });
    if (createdProfileId) {
      await db.preferenceProfile.delete({ where: { id: createdProfileId } });
      createdProfileId = null;
    }
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("renders a Leaflet map on /map", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator("h1")).toHaveText("מפה");
    // Leaflet adds .leaflet-container to the initialized map div (no tiles needed).
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });
});
```

- [ ] **Step 2:** Run `npx playwright test tests/e2e/map.spec.ts` → PASS. (Stale `.next`/port-3000 recovery: kill the port-3000 process, delete `.next`, retry once.)
- [ ] **Step 3:** Run `npx vitest run` → all pass. Run `npx playwright test` → all specs pass (onboarding, feed-and-feedback, listing-detail, add-listing, map).
- [ ] **Step 4:** Commit:

```bash
git add tests/e2e/map.spec.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "test: e2e for the map page"
```

---

## Done criteria

- `Listing` has `lat`/`lng`; manual adds geocode automatically; `npm run geocode` backfills existing rows.
- `/map` (in the nav) shows pins for located listings with popups linking to detail, and lists un-located ones below.
- `/listings` has a list⇄map toggle; the detail page shows a small map when coords exist.
- Leaflet renders below the sticky header (stacking context).
- `npx vitest run` and `npx playwright test` both green.
- Map visuals confirmed in the browser (tiles + pins) by the controller after merge.
