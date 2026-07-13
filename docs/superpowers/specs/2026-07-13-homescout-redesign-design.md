# HomeScout redesign — design spec

**Date:** 2026-07-13
**Status:** Approved for planning

## Goal

Turn the current bare, English, single-list app into a clean, Hebrew (RTL)
home-search assistant with a proper first-run onboarding, an always-editable
profile, a dashboard home, a map view, a per-listing detail view with notes,
and a floating AI copilot that can navigate and make changes on the user's
behalf.

## Non-goals

- No authentication / multi-user support (single-user personal tool).
- No changes to the scraper's site coverage or scoring prompts beyond adding
  geocoding + neighborhood extraction.
- No mobile-native app; responsive web is enough (desktop-first, must not break
  on narrow screens).

## Language & direction

- All UI copy in Hebrew. Product name stays "HomeScout" (Latin).
- `<html lang="he" dir="rtl">`. Layout, nav, forms, and cards all RTL.
- Keep the existing Geist font (already loaded; fix the Arial override that
  currently shadows it). Numerals and `₪` render LTR naturally inside RTL text.
- Copy tone: plain, warm, sentence case.

## Information architecture

First-run gate: on any route, if no `PreferenceProfile` row exists, redirect to
`/onboarding`. Once a profile is saved, `/onboarding` and `/` behave normally.

| Route | Hebrew nav label | Purpose |
|-------|------------------|---------|
| `/` | לוח בקרה | Dashboard (layout א' — top-to-bottom overview) |
| `/listings` | מודעות | Feed / triage, with list ⇄ map toggle + filter |
| `/map` | מפה | All listings as map pins |
| `/listings/[id]` | — | Listing detail view (facts, map, notes) |
| `/compare` | השוואה | Compare 2–4 favorites (existing logic, restyled) |
| `/profile` | פרופיל | Editable profile (same form component as onboarding) |

The floating copilot bubble is present on every screen (in the root layout).

## Dashboard (layout א')

Top-to-bottom sections inside the standard page container:

1. **Profile summary strip** — 3 compact tiles (אזורים, תקציב, חדרים) pulled from
   `PreferenceProfile`, with an "עריכה" link to `/profile`.
2. **Saved / favorites** — cards for listings the user has liked (reuse
   `ListingCard`), each linking to its detail page. Includes a "X מודעות חדשות ←"
   link to `/listings`.
3. **Compare shortcut** — link/CTA into `/compare`.

Empty states: if no favorites yet, show an invitation to review מודעות.

## Onboarding & profile (shared component)

- A single clean page (no wizard). The existing `OnboardingForm` fields, grouped
  into labeled sections: **איפה** (locations), **תקציב** (budget, renovation),
  **העדפות** (rooms, size, extras, goal, flags, free text, example URLs).
- The same component powers `/onboarding` (first run → redirect to `/` on save)
  and `/profile` (edit mode → pre-filled from the existing profile, saves in
  place, stays on `/profile` with a saved confirmation).
- **API changes required** (verified against current code):
  - `POST /api/onboarding` currently only `create`s a profile, which would
    produce duplicate rows on edit. Change it to **upsert** the single profile
    (this is a single-user tool — there is exactly one `PreferenceProfile`).
  - Add `GET /api/onboarding` (or `/api/profile`) returning the current profile
    (or `null`) so the form can pre-fill and the first-run gate can detect
    existence.
- **Serialization:** `locations`, `mustHaveExtras`, and `exampleUrls` are stored
  as JSON strings in the DB. The GET endpoint (or the form) must parse them back
  into arrays for pre-fill; the existing POST already `JSON.stringify`s them.

## Data model changes

Add to `Listing` (Prisma):

- `lat        Float?`   — geocoded latitude
- `lng        Float?`   — geocoded longitude
- `neighborhood String?` — parsed/geocoded neighborhood
- `notes      String?`  — user's free-text notes for this listing

Migration via `prisma migrate`. No changes to other models.

## Geocoding

- Use Nominatim (OpenStreetMap) — free, no API key. Respect its usage policy
  (1 req/sec, set a descriptive User-Agent).
- Geocode on scrape ingest: when a new listing is created, resolve
  `address` → `lat/lng` + `neighborhood`. Failures are non-fatal (leave null;
  the listing still shows, just no pin).
- Backfill script (`scripts/` or a one-off `tsx`) to geocode existing rows.
- Cache/skip rows that already have coordinates.

## Map view

- Leaflet + OpenStreetMap tiles (client-only component; dynamically imported to
  avoid SSR issues in Next.js).
- `/map`: pins for all active listings with coordinates. Pin popup shows address,
  price, match score, and a link to the detail page. Listings without coords are
  listed below the map as "ללא מיקום" so they aren't lost.
- `/listings` gets a **list ⇄ map** toggle reusing the same map component.

## Listing detail view (`/listings/[id]`)

- Fetch one listing (`GET /api/listings/[id]`).
- Sections: header (address, שכונה, match-score pill); key facts tiles (מחיר,
  חדרים, מ"ר, קומה); amenity chips (ממ"ד, מרפסת, חניה, מעלית, משופצת — present vs
  muted-absent); a small Leaflet map centered on the listing; the match reason;
  an editable **הערות שלי** textarea; save/dislike actions; link to the original
  listing URL.
- Notes persistence: `PATCH /api/listings/[id]` with `{ notes }`. Debounced or
  explicit "שמור" — explicit save button to keep it simple and predictable.

## Copilot (AI assistant)

**UI:** a floating circular button (bottom corner, RTL-aware) in the root layout.
Clicking opens a chat panel. Hebrew placeholder + replies. State is client-side
(conversation kept in the component); no persistence required for v1.

**Backend:** `POST /api/assistant` receives the conversation and runs Claude
(`@anthropic-ai/sdk`, already a dependency) with tool-calling in a loop until it
produces a final text answer. Latest capable model.

**Tools** (all operate on the user's own data or navigation — safe to apply
directly, no confirmation needed):

| Tool | Executes | Effect |
|------|----------|--------|
| `navigate(path)` | client | Router push to a route |
| `updateProfile(fields)` | server | Patch `PreferenceProfile` (partial) |
| `setListingFilter(filter)` | client | Set the מודעות filter (all/favorites/unseen) |
| `openListing(id)` | client | Navigate to a listing detail page |
| `addNote(listingId, text)` | server | Set/append a listing's notes |

Server-side tools hit the DB directly and return results into the tool loop.
Client-side tools (navigate/filter/open) can't run on the server, so the API
returns a structured list of "client actions" alongside the assistant's text;
the chat component performs them after rendering the reply. The system prompt
tells Claude it is a Hebrew-speaking home-search assistant, lists the tools, and
instructs it to confirm what it did in plain Hebrew.

**Safety note:** every tool touches only the user's own preferences, notes, or
navigation — nothing outward-facing, destructive, or irreversible — so direct
application is appropriate. If the tool set later grows to outward actions
(e.g. contacting a broker), those must move behind explicit confirmation.

## Styling

Build on the design-token system already added to `globals.css` (neutrals, blue
accent, radius, shadows, light+dark). Extend with RTL-aware rules and the new
components (dashboard sections, detail tiles, amenity chips, map container,
copilot bubble/panel). Keep it flat, airy, "simple and clean".

## Testing

- Unit (vitest): geocoding parse/fallback; assistant tool dispatch (each tool
  maps to the right effect; unknown tool handled); notes PATCH validation;
  onboarding-gate redirect logic.
- E2E (playwright): first-run redirect to onboarding → save → land on dashboard;
  edit profile persists; open listing detail, add a note, reload, note persists;
  map renders pins; copilot: send "הוסף חניה לדרישות" → profile updated.
- Mock the Anthropic API and Nominatim in tests (no live network).

## Build order (phases)

1. **Shell** — RTL/Hebrew, onboarding-gate, dashboard (layout א'), profile page.
2. **Detail + notes** — detail route, notes field + PATCH endpoint.
3. **Map + geocoding** — schema fields, geocode on ingest, backfill, `/map` +
   list/map toggle.
4. **Copilot** — assistant endpoint, tool loop, floating chat UI.

Each phase leaves the app in a working, shippable state.

## Open risks

- Nominatim rate limits / address-format quality for Israeli addresses may yield
  imperfect neighborhoods; acceptable to leave null when unsure.
- Leaflet SSR in Next.js App Router requires a client-only dynamic import.
- Copilot returning client actions must be robust to Claude calling a
  client-only tool — the loop returns those as actions rather than trying to run
  them server-side.
