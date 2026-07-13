# HomeScout Phase 1 (Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app to a Hebrew/RTL shell with a first-run onboarding gate, an always-editable profile page, and a dashboard home — leaving a working, shippable app.

**Architecture:** Next.js App Router. A single `PreferenceProfile` row drives a first-run gate (server components read it via a shared `getProfile()` helper and `redirect()`). The onboarding form component is reused for both first-run (`/onboarding`) and editing (`/profile`). The dashboard (`/`) is a server component querying favorites directly through Prisma. All copy is Hebrew; `<html>` is `lang="he" dir="rtl"`.

**Tech Stack:** Next.js 14 (App Router), React 18, Prisma + SQLite, Zod, Vitest (unit/integration), Playwright (e2e).

**Scope note:** This is Phase 1 of 4 (spec: `docs/superpowers/specs/2026-07-13-homescout-redesign-design.md`). Phases 2 (detail+notes), 3 (map+geocoding), and 4 (copilot) get their own plans after this lands.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/profile.ts` | `getProfile()` — read the single profile, parse JSON fields, or `null` | Create |
| `src/app/api/onboarding/route.ts` | `POST` upserts the profile; `GET` returns it | Modify |
| `src/app/layout.tsx` | Root: `lang="he" dir="rtl"`, Hebrew metadata | Modify |
| `src/app/globals.css` | RTL fix + dashboard styles | Modify |
| `src/components/Header.tsx` | Hebrew nav labels | Modify |
| `src/components/HealthStatus.tsx` | Hebrew status copy | Modify |
| `src/components/OnboardingForm.tsx` | Hebrew form + `mode`/`initial` props (create vs edit) | Modify |
| `src/app/onboarding/page.tsx` | First-run: redirect to `/` if profile exists; Hebrew | Modify |
| `src/app/profile/page.tsx` | Editable profile (edit-mode form, pre-filled) | Create |
| `src/app/page.tsx` | Dashboard (gate + profile summary + favorites) | Rewrite |
| `src/app/listings/page.tsx` | Hebrew copy | Modify |
| `src/app/compare/page.tsx` | Hebrew copy | Modify |
| `src/components/CompareTable.tsx` | Hebrew row labels | Modify |
| `src/components/ListingCard.tsx` | Hebrew copy + Hebrew action labels | Modify |
| `tests/integration/onboarding-route.test.ts` | Upsert + GET coverage | Modify |
| `tests/e2e/onboarding.spec.ts` | Hebrew, land on dashboard | Modify |
| `tests/e2e/feed-and-feedback.spec.ts` | Retarget to `/listings`, Hebrew button, favorites assertion | Modify |

---

## Task 1: Profile helper + onboarding upsert & GET

**Files:**
- Create: `src/lib/profile.ts`
- Modify: `src/app/api/onboarding/route.ts`
- Test: `tests/integration/onboarding-route.test.ts`

- [ ] **Step 1: Write the profile helper**

Create `src/lib/profile.ts`:

```ts
import { db } from "@/lib/db";

export interface ProfileData {
  id: string;
  locations: string[];
  budgetMax: number;
  minRooms: number | null;
  minSizeSqm: number | null;
  mustHaveExtras: string[];
  goal: string;
  openToRenting: boolean;
  openToFixerUpper: boolean;
  renovationBudget: number | null;
  freeText: string | null;
  exampleUrls: string[];
}

// Single-user tool: there is at most one PreferenceProfile. Return it with the
// JSON-string columns parsed back into arrays, or null if onboarding hasn't run.
export async function getProfile(): Promise<ProfileData | null> {
  const row = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!row) return null;
  return {
    id: row.id,
    locations: JSON.parse(row.locations),
    budgetMax: row.budgetMax,
    minRooms: row.minRooms,
    minSizeSqm: row.minSizeSqm,
    mustHaveExtras: JSON.parse(row.mustHaveExtras),
    goal: row.goal,
    openToRenting: row.openToRenting,
    openToFixerUpper: row.openToFixerUpper,
    renovationBudget: row.renovationBudget,
    freeText: row.freeText,
    exampleUrls: JSON.parse(row.exampleUrls),
  };
}
```

- [ ] **Step 2: Rewrite the onboarding route to upsert + expose GET**

Replace the entire contents of `src/app/api/onboarding/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";
import { getProfile } from "@/lib/profile";

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const fields = {
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
  };

  // Single-user tool: update the existing profile if present, else create.
  const existing = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  const profile = existing
    ? await db.preferenceProfile.update({ where: { id: existing.id }, data: fields })
    : await db.preferenceProfile.create({ data: fields });

  return NextResponse.json({ profile });
}
```

- [ ] **Step 3: Add failing tests for upsert + GET**

In `tests/integration/onboarding-route.test.ts`, change the import line to include `GET`:

```ts
import { POST, GET } from "@/app/api/onboarding/route";
```

Add these tests inside the `describe` block (a `validPayload` helper keeps them DRY):

```ts
  const validPayload = (over: Record<string, unknown> = {}) => ({
    locations: ["Tel Aviv"],
    budgetMax: 3000000,
    goal: "primary",
    mustHaveExtras: [],
    exampleUrls: [],
    ...over,
  });

  it("updates the existing profile instead of creating a second one", async () => {
    const first = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ budgetMax: 3000000 })),
    });
    await POST(first as any);

    const second = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ budgetMax: 4200000 })),
    });
    const res = await POST(second as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.budgetMax).toBe(4200000);
    expect(await db.preferenceProfile.count()).toBe(1);
  });

  it("GET returns the stored profile with parsed array fields", async () => {
    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(validPayload({ locations: ["Tel Aviv", "Ramat Gan"] })),
    });
    await POST(req as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.locations).toEqual(["Tel Aviv", "Ramat Gan"]);
  });

  it("GET returns null when no profile exists", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.profile).toBeNull();
  });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/integration/onboarding-route.test.ts`
Expected: PASS (all tests, including the existing three). If the test DB is missing the schema, first run: `DATABASE_URL="file:./test.db" npx prisma migrate deploy`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile.ts src/app/api/onboarding/route.ts tests/integration/onboarding-route.test.ts
git commit -m "feat: upsert preference profile and add GET + getProfile helper"
```

---

## Task 2: RTL + Hebrew shell chrome

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/components/Header.tsx`, `src/components/HealthStatus.tsx`

- [ ] **Step 1: Flip the document to Hebrew/RTL**

In `src/app/layout.tsx`, change the `<html>` tag and metadata:

```tsx
export const metadata: Metadata = {
  title: "HomeScout — עוזר חיפוש הדירה שלך",
  description: "מודעות דירות מותאמות אישית, מדורגות ומוכנות לעיון.",
};
```

```tsx
    <html lang="he" dir="rtl">
```

(Leave the `<body>`, `<Header />`, `<HealthStatus />`, `{children}` structure unchanged.)

- [ ] **Step 2: Make the nav RTL-safe**

In `src/app/globals.css`, change the physical `margin-left` on `.site-nav` to a logical property so it hugs the correct edge in RTL:

```css
.site-nav {
  display: flex;
  gap: 4px;
  margin-inline-start: auto;
}
```

- [ ] **Step 3: Hebrew nav labels**

In `src/components/Header.tsx`, replace the `NAV` array:

```tsx
const NAV = [
  { href: "/", label: "לוח בקרה" },
  { href: "/listings", label: "מודעות" },
  { href: "/compare", label: "השוואה" },
  { href: "/profile", label: "פרופיל" },
];
```

(Keep the brand text "HomeScout" and the `⌂` mark.)

- [ ] **Step 4: Hebrew health status copy**

In `src/components/HealthStatus.tsx`, translate the three rendered strings and the notes. Replace the error, no-run, and loaded return blocks:

```tsx
  if (status.kind === "loading") return null;

  if (status.kind === "error") {
    return (
      <div className="health">
        <span className="health__pill">
          <span className="health__dot" data-state="error" />
          לא ניתן לבדוק את סטטוס הסריקה — ראו יומני שרת.
        </span>
      </div>
    );
  }

  const lastRun = status.lastRun;

  if (!lastRun) {
    return (
      <div className="health">
        <span className="health__pill">
          <span className="health__dot" />
          עדיין לא בוצעה סריקה.
        </span>
      </div>
    );
  }

  const notes = [
    lastRun.skippedListings > 0 ? `${lastRun.skippedListings} דולגו (נתונים חסרים)` : null,
    lastRun.failedScoring > 0 ? `${lastRun.failedScoring} ללא דירוג (שגיאת Claude)` : null,
  ].filter(Boolean);

  return (
    <div className="health">
      <span className="health__pill">
        <span className="health__dot" data-state={lastRun.success ? "ok" : "error"} />
        סריקה אחרונה {new Date(lastRun.startedAt).toLocaleString("he-IL")} —{" "}
        {lastRun.success ? `${lastRun.newListings} מודעות חדשות` : `נכשלה: ${lastRun.errorMessage ?? "שגיאה לא ידועה"}`}
        {notes.length > 0 && ` (${notes.join(", ")})`}
      </span>
    </div>
  );
```

- [ ] **Step 5: Verify in the browser**

Run the dev server (`npm run dev`) and load `http://localhost:3000`. Expected: layout is right-aligned (RTL), nav labels are Hebrew and sit on the left edge, brand "HomeScout" on the right, health pill in Hebrew. (No automated test — this is chrome/styling.)

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/Header.tsx src/components/HealthStatus.tsx
git commit -m "feat: Hebrew RTL shell — html dir, nav labels, health status"
```

---

## Task 3: Onboarding form — Hebrew + edit mode

**Files:**
- Modify: `src/components/OnboardingForm.tsx`

- [ ] **Step 1: Add props, pre-fill, and edit behavior**

Replace the entire contents of `src/components/OnboardingForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData } from "@/lib/profile";

interface OnboardingFormProps {
  mode?: "create" | "edit";
  initial?: ProfileData | null;
}

export function OnboardingForm({ mode = "create", initial = null }: OnboardingFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("יש לבדוק את הטופס — משהו חסר או לא תקין.");
      return;
    }

    if (mode === "edit") {
      setSaved(true);
      router.refresh();
    } else {
      router.push("/");
    }
  }

  const csv = (a: string[] | undefined) => (a ?? []).join(", ");

  return (
    <form onSubmit={handleSubmit}>
      <label>אזורים (מופרדים בפסיקים)<input name="locations" required defaultValue={csv(initial?.locations)} /></label>
      <label>תקציב מקסימלי (₪)<input name="budgetMax" type="number" required defaultValue={initial?.budgetMax ?? ""} /></label>
      <label>מינימום חדרים<input name="minRooms" type="number" step="0.5" defaultValue={initial?.minRooms ?? ""} /></label>
      <label>מינימום שטח (מ&quot;ר)<input name="minSizeSqm" type="number" defaultValue={initial?.minSizeSqm ?? ""} /></label>
      <label>דרישות חובה (מופרדות בפסיקים, למשל חניה, ממ&quot;ד, מרפסת)<input name="mustHaveExtras" defaultValue={csv(initial?.mustHaveExtras)} /></label>
      <label>
        מטרה
        <select name="goal" required defaultValue={initial?.goal ?? ""}>
          <option value="" disabled>בחר/י...</option>
          <option value="primary">מגורים</option>
          <option value="investment">השקעה</option>
        </select>
      </label>
      <label><input name="openToRenting" type="checkbox" defaultChecked={initial?.openToRenting ?? false} /> פתוח/ה לשכירות בשלב ראשון</label>
      <label><input name="openToFixerUpper" type="checkbox" defaultChecked={initial?.openToFixerUpper ?? false} /> פתוח/ה לדירה לשיפוץ</label>
      <label>תקציב שיפוץ (₪, אם רלוונטי)<input name="renovationBudget" type="number" defaultValue={initial?.renovationBudget ?? ""} /></label>
      <label>משהו נוסף? (טקסט חופשי)<textarea name="freeText" defaultValue={initial?.freeText ?? ""} /></label>
      <label>מודעות לדוגמה שכבר ראית (כתובות מופרדות בפסיקים)<textarea name="exampleUrls" defaultValue={csv(initial?.exampleUrls)} /></label>

      {error && <p role="alert">{error}</p>}
      {saved && <p className="form-saved">ההעדפות נשמרו.</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "שומר…" : mode === "edit" ? "עדכון העדפות" : "שמירת העדפות"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Add the saved-confirmation style**

In `src/app/globals.css`, add near the form styles:

```css
.form-saved {
  color: var(--success);
  background: var(--success-soft);
  border: 1px solid color-mix(in srgb, var(--success) 30%, var(--border));
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`initial` type flows from `ProfileData`; `router.refresh` exists on the App Router router.)

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingForm.tsx src/app/globals.css
git commit -m "feat: Hebrew onboarding form with create/edit modes and pre-fill"
```

---

## Task 4: Onboarding gate + Profile page

**Files:**
- Modify: `src/app/onboarding/page.tsx`
- Create: `src/app/profile/page.tsx`

- [ ] **Step 1: Gate the onboarding page and translate it**

Replace the entire contents of `src/app/onboarding/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile) redirect("/");

  return (
    <main>
      <h1>ספרו לנו מה אתם מחפשים</h1>
      <p className="page-subtitle">
        נשתמש בזה כדי לדרג כל מודעה חדשה כך שההתאמות הטובות ביותר יעלו למעלה.
      </p>
      <OnboardingForm mode="create" />
    </main>
  );
}
```

- [ ] **Step 2: Create the profile edit page**

Create `src/app/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getProfile } from "@/lib/profile";

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main>
      <h1>הפרופיל שלי</h1>
      <p className="page-subtitle">
        עדכנו את ההעדפות בכל עת — הדירוג של מודעות חדשות יתעדכן בהתאם.
      </p>
      <OnboardingForm mode="edit" initial={profile} />
    </main>
  );
}
```

- [ ] **Step 3: Verify the gate manually**

With an empty profile table (`DATABASE_URL="file:./dev.db" npx prisma studio` or delete rows), load `/` → should redirect to `/onboarding`. Submit the form → land on `/`. Then load `/onboarding` again → should redirect to `/`. Load `/profile` → form pre-filled with saved values. (Covered by e2e in Task 7; this is a sanity check.)

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/page.tsx src/app/profile/page.tsx
git commit -m "feat: onboarding first-run gate and editable profile page"
```

---

## Task 5: Dashboard home

**Files:**
- Rewrite: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the feed with a dashboard**

Replace the entire contents of `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const favorites = await db.listing.findMany({
    where: { feedback: { some: { reaction: "like" } } },
    orderBy: { matchScore: "desc" },
  });
  const newCount = await db.listing.count({ where: { feedback: { none: {} } } });

  return (
    <main>
      <h1>לוח בקרה</h1>
      <p className="page-subtitle">ההעדפות והמודעות השמורות שלך במקום אחד.</p>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2>הפרופיל שלך</h2>
          <Link href="/profile" className="dash-link">עריכה ←</Link>
        </div>
        <div className="dash-tiles">
          <div className="dash-tile"><span>אזורים</span><strong>{profile.locations.join(", ")}</strong></div>
          <div className="dash-tile"><span>תקציב</span><strong>₪{profile.budgetMax.toLocaleString()}</strong></div>
          <div className="dash-tile"><span>חדרים</span><strong>{profile.minRooms ? `${profile.minRooms}+` : "—"}</strong></div>
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2>שמורים · מועדפים</h2>
          <Link href="/listings" className="dash-link">{newCount} מודעות חדשות ←</Link>
        </div>
        {favorites.length === 0 ? (
          <div className="empty">עדיין אין מועדפים — עברו על המודעות וסמנו את מה שמעניין.</div>
        ) : (
          <div className="card-list">
            {favorites.map((l) => (
              <article className="listing" key={l.id}>
                <h3>{l.address}</h3>
                <p className="listing__meta">
                  ₪{l.price.toLocaleString()} · {l.rooms} חד&apos; · {l.sizeSqm} מ&quot;ר
                  {l.matchScore !== null ? ` · ${l.matchScore}/100` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <Link href="/compare" className="dash-cta">השוואת מועדפים ←</Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add dashboard styles**

In `src/app/globals.css`, add:

```css
.dash-section {
  margin-bottom: 32px;
}

.dash-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dash-section__head h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
}

.dash-link,
.dash-cta {
  font-size: 14px;
  color: var(--accent);
}

.dash-cta {
  display: inline-block;
  padding: 12px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.dash-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.dash-tile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}

.dash-tile span {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.dash-tile strong {
  font-size: 15px;
  font-weight: 600;
}

@media (max-width: 560px) {
  .dash-tiles {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Verify in the browser**

With a saved profile and at least one liked listing (seed if needed), load `/`. Expected: three profile tiles, a favorites list, a "N מודעות חדשות" link, and a compare CTA — all RTL and Hebrew.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: dashboard home with profile summary and favorites"
```

---

## Task 6: Hebrew-ize listings, compare, and cards

**Files:**
- Modify: `src/app/listings/page.tsx`, `src/app/compare/page.tsx`, `src/components/CompareTable.tsx`, `src/components/ListingCard.tsx`

- [ ] **Step 1: Translate the listing card**

In `src/components/ListingCard.tsx`, replace the meta line and the two action buttons:

```tsx
      <p className="listing__meta">
        ₪{price.toLocaleString()} · {rooms} חד&apos; · {sizeSqm} מ&quot;ר
      </p>
```

```tsx
      <div className="listing__actions">
        <button className="btn-like" onClick={() => onFeedback(id, "like")} disabled={disabled}>
          שמור
        </button>
        <button className="btn-dislike" onClick={() => onFeedback(id, "dislike")} disabled={disabled}>
          לא מתאים
        </button>
      </div>
```

(The `matchReason` text comes from data and stays as-is.)

- [ ] **Step 2: Translate the listings page**

In `src/app/listings/page.tsx`, replace the `return (...)` JSX header/controls (keep all hooks and `handleFeedback` unchanged):

```tsx
  return (
    <main>
      <h1>מודעות</h1>
      <p className="page-subtitle">כל מה שנמצא עד כה — סננו כדי להתמקד.</p>
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
    </main>
  );
```

- [ ] **Step 3: Translate the compare page**

In `src/app/compare/page.tsx`, replace the `return (...)` JSX (keep hooks/`toggle`/`selected` unchanged):

```tsx
  return (
    <main>
      <h1>השוואה</h1>
      <p className="page-subtitle">בחרו 2–4 מועדפים לתצוגה זו לצד זו.</p>
      {listings.length === 0 ? (
        <div className="empty">עדיין אין מועדפים — סמנו כמה מודעות קודם.</div>
      ) : (
        <ul className="compare-picker">
          {listings.map((l) => {
            const atCap = selectedIds.length >= 4 && !selectedIds.includes(l.id);
            return (
              <li key={l.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(l.id)}
                    onChange={() => toggle(l.id)}
                    disabled={atCap}
                  />
                  {l.address}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {selectedIds.length >= 4 && (
        <p className="page-subtitle">נבחרו 4 (מקסימום) — הסירו סימון כדי לבחור אחר.</p>
      )}
      {selected.length >= 2 && <CompareTable listings={selected} />}
    </main>
  );
```

- [ ] **Step 4: Translate the compare table row labels**

In `src/components/CompareTable.tsx`, replace the `rows` array:

```tsx
  const rows: { label: string; get: (l: CompareListing) => string | number }[] = [
    { label: "כתובת", get: (l) => l.address },
    { label: "מחיר", get: (l) => `₪${l.price.toLocaleString()}` },
    { label: "חדרים", get: (l) => l.rooms },
    { label: 'שטח (מ"ר)', get: (l) => l.sizeSqm },
    { label: "ציון התאמה", get: (l) => l.matchScore ?? "—" },
  ];
```

- [ ] **Step 5: Typecheck + browser check**

Run: `npx tsc --noEmit` → no errors.
Load `/listings` and `/compare` → Hebrew copy, RTL, filter options in Hebrew, card buttons "שמור"/"לא מתאים".

- [ ] **Step 6: Commit**

```bash
git add src/app/listings/page.tsx src/app/compare/page.tsx src/components/CompareTable.tsx src/components/ListingCard.tsx
git commit -m "feat: Hebrew copy for listings, compare, and listing cards"
```

---

## Task 7: Update e2e tests for the new flow

**Files:**
- Modify: `tests/e2e/onboarding.spec.ts`, `tests/e2e/feed-and-feedback.spec.ts`

- [ ] **Step 1: Update the onboarding e2e (with gate-safe snapshot/restore)**

The new onboarding gate redirects `/onboarding` → `/` whenever a profile already
exists, so the test must start with an **empty** profile table — but `dev.db` may
hold a real dev profile that must be preserved. Replace the `beforeEach`/`afterEach`
(and the test) so the suite snapshots all profiles, clears the table, runs, then
restores the originals. Replace everything from `test.describe("onboarding", ...` to
the end of that describe block:

```ts
type ProfileRow = Awaited<ReturnType<typeof db.preferenceProfile.findFirst>>;

test.describe("onboarding", () => {
  let snapshot: NonNullable<ProfileRow>[];

  test.beforeEach(async () => {
    // Snapshot and clear so the onboarding gate lets us reach the form.
    snapshot = await db.preferenceProfile.findMany();
    await db.preferenceProfile.deleteMany();
  });

  test.afterEach(async () => {
    // Remove whatever the test created, then restore the real dev profile(s)
    // exactly as they were (explicit ids + createdAt; updatedAt is @updatedAt).
    await db.preferenceProfile.deleteMany();
    for (const p of snapshot) {
      await db.preferenceProfile.create({
        data: {
          id: p.id,
          locations: p.locations,
          budgetMax: p.budgetMax,
          minRooms: p.minRooms,
          minSizeSqm: p.minSizeSqm,
          mustHaveExtras: p.mustHaveExtras,
          goal: p.goal,
          openToRenting: p.openToRenting,
          openToFixerUpper: p.openToFixerUpper,
          renovationBudget: p.renovationBudget,
          freeText: p.freeText,
          exampleUrls: p.exampleUrls,
          learnedSummary: p.learnedSummary,
          createdAt: p.createdAt,
        },
      });
    }
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("user can complete onboarding and land on the dashboard", async ({ page }) => {
    await page.goto("/onboarding");

    await page.fill('input[name="locations"]', "Tel Aviv, Ramat Gan");
    await page.fill('input[name="budgetMax"]', "3000000");
    await page.selectOption('select[name="goal"]', "primary");
    await page.fill('textarea[name="freeText"]', "quiet street, near a park");

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toHaveText("לוח בקרה");
  });
});
```

(The top-of-file imports, the `dotenv` config, the `dev.db` guard, and the
`const db = new PrismaClient();` line stay exactly as they are.)

- [ ] **Step 2: Update the feed/feedback e2e**

The dashboard (`/`) now shows only favorites, so the "review a fresh listing" flow lives on `/listings`. In `tests/e2e/feed-and-feedback.spec.ts`, replace the final `test(...)` block (keep the whole `beforeEach`/`afterEach`/`afterAll` and seeding unchanged):

```ts
  test("liking a listing marks it as a favorite", async ({ page }) => {
    await page.goto("/listings");

    const card = page.locator("article").filter({ hasText: address });
    await expect(card).toHaveCount(1);

    await card.getByRole("button", { name: "שמור", exact: true }).click();

    // The listings view keeps items after feedback (it's a browsing/history
    // view, not a triage queue). Switch to the favorites filter and confirm
    // the liked listing now appears there.
    await page.selectOption("select#filter", "favorites");
    await expect(page.locator("article").filter({ hasText: address })).toHaveCount(1);
  });
```

- [ ] **Step 3: Run the full e2e suite**

Run: `npx playwright test`
Expected: both specs PASS. (Playwright's `webServer` builds/serves the app; ensure `dev.db` has the schema via `npx prisma migrate deploy`.)

- [ ] **Step 4: Run the full unit/integration suite**

Run: `npx vitest run`
Expected: all PASS (no English-copy assertions remain in unit/integration tests — those assert on data/status, not UI strings).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/onboarding.spec.ts tests/e2e/feed-and-feedback.spec.ts
git commit -m "test: update e2e flows for dashboard + Hebrew listings"
```

---

## Done criteria

- First load with no profile → `/onboarding`; after save → dashboard.
- `/profile` pre-fills and edits in place without creating duplicate rows.
- All shell/screens render RTL and in Hebrew.
- `npx vitest run` and `npx playwright test` both green.
- App is shippable; Phases 2–4 layer on top without reworking this.
