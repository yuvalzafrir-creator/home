# HomeScout Phase 2 (Detail + Notes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-listing detail page with an editable notes box, and close the Phase 1 gate gap so `/listings` and `/compare` also require a profile.

**Architecture:** A new server-component route `/listings/[id]` gates on profile, reads the listing directly via Prisma, and renders facts/amenities/match-reason plus a small client `ListingNotes` component that saves through a new `PATCH /api/listings/[id]`. `/listings` and `/compare` become thin server-component gates wrapping their existing client UI (extracted into `*Client.tsx`). A Prisma migration adds `notes` and `neighborhood` columns to `Listing`. (The Leaflet map on the detail page is intentionally deferred to Phase 3, which adds `lat`/`lng` + geocoding.)

**Tech Stack:** Next.js 14 (App Router), React 18, Prisma + SQLite, Zod, Vitest, Playwright.

**Scope note:** Phase 2 of 4 (spec: `docs/superpowers/specs/2026-07-13-homescout-redesign-design.md`). Builds on Phase 1 (merged). Phase 3 (map+geocoding) and Phase 4 (copilot) follow.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/app/listings/ListingsClient.tsx` | The existing listings client UI (moved) | Create |
| `src/app/listings/page.tsx` | Server gate → renders `ListingsClient` | Rewrite |
| `src/app/compare/CompareClient.tsx` | The existing compare client UI (moved) | Create |
| `src/app/compare/page.tsx` | Server gate → renders `CompareClient` | Rewrite |
| `prisma/schema.prisma` | Add `notes`, `neighborhood` to `Listing` | Modify |
| `src/app/api/listings/[id]/route.ts` | `PATCH` listing notes | Create |
| `src/app/listings/[id]/page.tsx` | Listing detail (server, gated) | Create |
| `src/components/ListingNotes.tsx` | Notes textarea + save (client) | Create |
| `src/components/ListingCard.tsx` | Link the address to the detail page | Modify |
| `src/app/page.tsx` | Link dashboard favorite cards to detail | Modify |
| `src/app/globals.css` | Detail page + amenity chip + notes styles | Modify |
| `tests/integration/listing-notes-route.test.ts` | PATCH coverage | Create |
| `tests/e2e/feed-and-feedback.spec.ts` | Ensure a profile exists (now-gated `/listings`) | Modify |
| `tests/e2e/listing-detail.spec.ts` | Detail + notes-persist flow | Create |

---

## Task 1: Gate `/listings` and `/compare`

**Files:**
- Create: `src/app/listings/ListingsClient.tsx`, `src/app/compare/CompareClient.tsx`
- Rewrite: `src/app/listings/page.tsx`, `src/app/compare/page.tsx`
- Modify: `tests/e2e/feed-and-feedback.spec.ts`

- [ ] **Step 1: Move the listings client UI into `ListingsClient.tsx`**

Create `src/app/listings/ListingsClient.tsx` with the CURRENT contents of `src/app/listings/page.tsx`, changing ONLY the declaration line `export default function ListingsHistoryPage() {` to `export function ListingsClient() {`. Keep `"use client";` at the top and everything else identical.

- [ ] **Step 2: Replace `src/app/listings/page.tsx` with a server gate**

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { ListingsClient } from "./ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return <ListingsClient />;
}
```

- [ ] **Step 3: Move the compare client UI into `CompareClient.tsx`**

Create `src/app/compare/CompareClient.tsx` with the CURRENT contents of `src/app/compare/page.tsx`, changing ONLY `export default function ComparePage() {` to `export function CompareClient() {`. Keep `"use client";` and everything else identical.

- [ ] **Step 4: Replace `src/app/compare/page.tsx` with a server gate**

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { CompareClient } from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return <CompareClient />;
}
```

- [ ] **Step 5: Make the feed e2e provision a profile (now that `/listings` is gated)**

`tests/e2e/feed-and-feedback.spec.ts` visits `/listings`, which now redirects to `/onboarding` unless a profile exists. Make the test self-sufficient: ensure a profile exists before the test and remove it only if the test created it. In the `test.describe("feed and feedback", ...)` block, add a tracking variable and augment the hooks. Add this variable declaration alongside the existing `let` declarations near the top of the describe:

```ts
  let createdProfileId: string | null = null;
```

At the END of the existing `test.beforeEach(async () => { ... })` body (after the profile snapshot lines), append:

```ts
    // /listings is gated on a profile existing (Phase 2). Ensure one is present;
    // remember if we created it so afterEach can remove exactly what we added.
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
```

At the START of the existing `test.afterEach(async () => { ... })` body (before the feedback/listing cleanup), prepend:

```ts
    if (createdProfileId) {
      await db.preferenceProfile.delete({ where: { id: createdProfileId } });
      createdProfileId = null;
    }
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build 2>&1 | tail -20` → `/listings` and `/compare` compile and appear as dynamic (ƒ).
Run: `npx playwright test` → both existing specs still pass (the feed test now provisions its own profile; onboarding test unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/app/listings src/app/compare tests/e2e/feed-and-feedback.spec.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: gate listings and compare on profile existence"
```

---

## Task 2: Add `notes` and `neighborhood` columns

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two nullable columns to the `Listing` model**

In `prisma/schema.prisma`, inside `model Listing { ... }`, add these two lines next to the other optional scalar fields (e.g. right after `description String?`):

```prisma
  neighborhood String?
  notes        String?
```

- [ ] **Step 2: Create and apply the migration (dev DB)**

Run: `npx prisma migrate dev --name add_listing_notes_neighborhood`
Expected: a new folder under `prisma/migrations/` is created and applied to `prisma/dev.db`; Prisma Client regenerates.

- [ ] **Step 3: Apply the migration to the test DB**

Run: `DATABASE_URL="file:./test.db" npx prisma migrate deploy`
Expected: "No pending migrations" or the new migration applied. This is required before Task 3's integration test can write `notes`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: add notes and neighborhood columns to Listing"
```

---

## Task 3: `PATCH /api/listings/[id]` for notes

**Files:**
- Create: `src/app/api/listings/[id]/route.ts`
- Test: `tests/integration/listing-notes-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/listing-notes-route.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { PATCH } from "@/app/api/listings/[id]/route";
import { db } from "@/lib/db";

async function makeListing() {
  return db.listing.create({
    data: {
      sourceSite: "yad2",
      sourceUrl: `https://yad2.co.il/item/notes-${Date.now()}-${Math.random()}`,
      address: "Notes Test St 1",
      price: 2000000,
      rooms: 3,
      sizeSqm: 70,
    },
  });
}

function patchReq(id: string, body: unknown) {
  return new Request(`http://localhost/api/listings/${id}`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("PATCH /api/listings/[id]", () => {
  afterEach(async () => {
    await db.listing.deleteMany({ where: { address: "Notes Test St 1" } });
  });

  it("saves notes on a listing", async () => {
    const listing = await makeListing();
    const res = await PATCH(patchReq(listing.id, { notes: "call the agent Sunday" }), {
      params: { id: listing.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.listing.notes).toBe("call the agent Sunday");
    const stored = await db.listing.findUnique({ where: { id: listing.id } });
    expect(stored!.notes).toBe("call the agent Sunday");
  });

  it("clears notes to null when given blank text", async () => {
    const listing = await makeListing();
    await PATCH(patchReq(listing.id, { notes: "temp" }), { params: { id: listing.id } });
    await PATCH(patchReq(listing.id, { notes: "   " }), { params: { id: listing.id } });

    const stored = await db.listing.findUnique({ where: { id: listing.id } });
    expect(stored!.notes).toBeNull();
  });

  it("returns 404 for an unknown listing", async () => {
    const res = await PATCH(patchReq("does-not-exist", { notes: "x" }), {
      params: { id: "does-not-exist" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed body", async () => {
    const listing = await makeListing();
    const res = await PATCH(patchReq(listing.id, "not json"), { params: { id: listing.id } });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/listing-notes-route.test.ts`
Expected: FAIL — the route module `@/app/api/listings/[id]/route` does not exist yet.

- [ ] **Step 3: Implement the route**

Create `src/app/api/listings/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const notesSchema = z.object({ notes: z.string() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = notesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.listing.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Store trimmed text, or null when blank, so a cleared box doesn't persist "".
  const notes = parsed.data.notes.trim() || null;
  const listing = await db.listing.update({
    where: { id: params.id },
    data: { notes },
  });

  return NextResponse.json({ listing });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/integration/listing-notes-route.test.ts`
Expected: PASS (4 tests). If it errors with "no such column: notes", the test DB migration from Task 2 Step 3 wasn't applied — run it, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/listings/[id]/route.ts tests/integration/listing-notes-route.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: PATCH endpoint to save listing notes"
```

---

## Task 4: Listing detail page + notes component

**Files:**
- Create: `src/app/listings/[id]/page.tsx`, `src/components/ListingNotes.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create the notes client component**

Create `src/components/ListingNotes.tsx`:

```tsx
"use client";

import { useState } from "react";

interface ListingNotesProps {
  listingId: string;
  initialNotes: string | null;
}

export function ListingNotes({ listingId, initialNotes }: ListingNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <section className="detail-section">
      <h2>הערות שלי</h2>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="לדוגמה: לתאם ביקור ביום ראשון, לבדוק חניה באזור"
      />
      <div className="notes-actions">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירת הערות"}
        </button>
        {saved && <span className="form-saved">ההערות נשמרו.</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the detail page**

Create `src/app/listings/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { ListingNotes } from "@/components/ListingNotes";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const listing = await db.listing.findUnique({ where: { id: params.id } });
  if (!listing) notFound();

  const amenities = [
    { label: "ממ\"ד", on: listing.hasMamad },
    { label: "מרפסת", on: listing.hasBalcony },
    { label: "חניה", on: listing.hasParking },
    { label: "מעלית", on: listing.hasElevator },
    { label: "משופצת", on: listing.renovated },
  ];

  return (
    <main>
      <Link href="/listings" className="back-link">← חזרה למודעות</Link>

      <div className="detail-head">
        <div>
          <h1>{listing.address}</h1>
          {listing.neighborhood && <p className="detail-neighborhood">{listing.neighborhood}</p>}
        </div>
        {listing.matchScore !== null && (
          <span className="detail-score">{listing.matchScore}/100 התאמה</span>
        )}
      </div>

      <div className="detail-tiles">
        <div className="dash-tile"><span>מחיר</span><strong>₪{listing.price.toLocaleString()}</strong></div>
        <div className="dash-tile"><span>חדרים</span><strong>{listing.rooms}</strong></div>
        <div className="dash-tile"><span>שטח</span><strong>{listing.sizeSqm} מ&quot;ר</strong></div>
        <div className="dash-tile"><span>קומה</span><strong>{listing.floor ?? "—"}</strong></div>
      </div>

      <div className="amenity-chips">
        {amenities.map((a) => (
          <span key={a.label} className="amenity-chip" data-off={!a.on}>{a.label}</span>
        ))}
      </div>

      {listing.matchReason && (
        <section className="detail-section">
          <h2>למה זה מתאים לך</h2>
          <p>{listing.matchReason}</p>
        </section>
      )}

      {listing.description && (
        <section className="detail-section">
          <h2>תיאור</h2>
          <p>{listing.description}</p>
        </section>
      )}

      <ListingNotes listingId={listing.id} initialNotes={listing.notes} />

      <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="detail-source">
        למודעה המקורית ↗
      </a>
    </main>
  );
}
```

- [ ] **Step 3: Add styles**

Append to `src/app/globals.css`:

```css
.back-link {
  display: inline-block;
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 16px;
}
.back-link:hover {
  color: var(--text);
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.detail-neighborhood {
  color: var(--text-muted);
  font-size: 14px;
  margin-top: 4px;
}

.detail-score {
  flex: none;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
}

.detail-tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.amenity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
}

.amenity-chip {
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.amenity-chip[data-off="true"] {
  color: var(--text-muted);
  opacity: 0.6;
  text-decoration: line-through;
}

.detail-section {
  margin-bottom: 28px;
}

.detail-section h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.notes-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.detail-source {
  display: inline-block;
  color: var(--accent);
  font-size: 14px;
}

@media (max-width: 560px) {
  .detail-tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build 2>&1 | tail -20` → `/listings/[id]` compiles (dynamic ƒ).

- [ ] **Step 5: Commit**

```bash
git add "src/app/listings/[id]/page.tsx" src/components/ListingNotes.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: listing detail page with editable notes"
```

---

## Task 5: Link cards to the detail page

**Files:**
- Modify: `src/components/ListingCard.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Link the listing-card address**

In `src/components/ListingCard.tsx`, add the import at the top (after `"use client";`):

```tsx
import Link from "next/link";
```

Replace the heading line `<h3>{address}</h3>` with:

```tsx
      <h3><Link href={`/listings/${id}`} className="listing__title">{address}</Link></h3>
```

(Everything else — meta, match, action buttons — stays unchanged.)

- [ ] **Step 2: Link the dashboard favorite cards**

In `src/app/page.tsx`, the favorites map renders `<article className="listing" key={l.id}>` with an `<h3>{l.address}</h3>`. Replace that heading with a linked one:

```tsx
                <h3><Link href={`/listings/${l.id}`} className="listing__title">{l.address}</Link></h3>
```

(`Link` is already imported in this file.)

- [ ] **Step 3: Add link styling**

Append to `src/app/globals.css`:

```css
.listing__title:hover {
  color: var(--accent);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListingCard.tsx src/app/page.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: link listing cards to the detail page"
```

---

## Task 6: E2E — detail + notes persistence

**Files:**
- Create: `tests/e2e/listing-detail.spec.ts`

- [ ] **Step 1: Write the e2e**

Create `tests/e2e/listing-detail.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

// See tests/e2e/onboarding.spec.ts for why .env.local is loaded explicitly and
// why PrismaClient is instantiated directly rather than importing "@/lib/db".
config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/listing-detail.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). ` +
      "Refusing to run against an unexpected database."
  );
}

const db = new PrismaClient();

test.describe("listing detail + notes", () => {
  let listingId: string;
  let createdProfileId: string | null = null;

  test.beforeEach(async () => {
    const unique = Date.now();
    const listing = await db.listing.create({
      data: {
        sourceSite: "yad2",
        sourceUrl: `https://yad2.co.il/item/detail-${unique}`,
        address: `Detail Test St ${unique}`,
        price: 2600000,
        rooms: 3,
        sizeSqm: 78,
        floor: 2,
        hasMamad: true,
        matchScore: 88,
        matchReason: "Great fit for your criteria",
      },
    });
    listingId = listing.id;

    // /listings/[id] is gated on a profile existing. Ensure one is present.
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

  test("shows facts and persists a note across reloads", async ({ page }) => {
    await page.goto(`/listings/${listingId}`);

    await expect(page.locator("h1")).toContainText("Detail Test St");
    await expect(page.getByText('78 מ"ר')).toBeVisible();

    const note = `visit Sunday ${Date.now()}`;
    await page.fill("textarea", note);
    await page.getByRole("button", { name: "שמירת הערות", exact: true }).click();
    await expect(page.getByText("ההערות נשמרו.")).toBeVisible();

    await page.reload();
    await expect(page.locator("textarea")).toHaveValue(note);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `npx playwright test tests/e2e/listing-detail.spec.ts`
Expected: PASS. (Playwright starts its own dev server; the test seeds its own listing + profile and cleans up.)

- [ ] **Step 3: Run the whole suite**

Run: `npx vitest run` → all pass.
Run: `npx playwright test` → all three e2e specs pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/listing-detail.spec.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "test: e2e for listing detail and notes persistence"
```

---

## Done criteria

- `/listings` and `/compare` redirect to `/onboarding` when no profile exists.
- Every listing card (feed + dashboard favorites) links to `/listings/[id]`.
- The detail page shows facts, amenity chips, match reason, and a notes box that persists via `PATCH /api/listings/[id]`.
- `npx vitest run` and `npx playwright test` both green.
- No map yet (Phase 3); the detail layout leaves room for it.
