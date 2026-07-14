# Add-listing-by-URL + source links — design spec

**Date:** 2026-07-14
**Status:** Approved for planning

## Goal

Let the user grow the listing set themselves: paste a listing URL and have the
tool auto-fill the details (with a manual fallback when a site blocks fetching),
plus surface links to each listing's original page and to the source websites for
manual browsing.

This is the phase the user chose to do before the map view (map is next).

## Requirements

1. **"Original" link on every listing card** — feed and dashboard favorites each
   link to the listing's `sourceUrl` ("למודעה המקורית ↗").
2. **Browse-the-sources section** — a small block on the `/listings` page with
   external links to Yad2 and Madlan search pages.
3. **Add a listing by URL** — a form where the user pastes a URL; the tool
   best-effort auto-fills the fields via a server fetch + Claude extraction; the
   user reviews/edits and saves; the listing is scored and stored. If the fetch
   is blocked, the user fills the form manually (URL preserved).

## Non-goals

- No live re-scraping of search pages (unchanged; still blocked by Yad2).
- No editing of a listing's core facts after creation (notes are the only
  post-hoc edit; Phase 2). Add-by-URL is create-only.
- No image handling beyond storing a `photoUrl` string if extraction returns one.

## Data model

No schema changes. `Listing` already has every field needed
(`sourceSite`, `sourceUrl` (unique), `address`, `price`, `rooms`, `sizeSqm`,
`floor?`, `hasParking`, `hasBalcony`, `hasMamad`, `hasElevator`, `renovated`,
`description?`, `photoUrl?`, `matchScore?`, `matchReason?`).

The `Listing` TypeScript type in `src/types/listing.ts` is extended with
`sourceUrl: string` and `sourceSite: string` so cards can render the original
link. (`/api/listings` already returns the full Prisma row.)

## Extraction

`src/lib/extract-listing.ts`:

```
type ExtractResult =
  | { ok: true; fields: ExtractedFields }
  | { ok: false; reason: "blocked" | "fetch_failed" | "parse_failed" };
```

- `ExtractedFields` = the manually-editable subset: `address`, `price`, `rooms`,
  `sizeSqm`, `floor`, `hasParking`, `hasBalcony`, `hasMamad`, `hasElevator`,
  `description` (all nullable/best-effort).
- Flow: `fetch(url)` with a browser-like `User-Agent`. On network error →
  `fetch_failed`. If the body trips the existing bot-challenge detector
  (Radware/verify-message/Incident ID) → `blocked`. Otherwise strip the HTML to
  visible text (Cheerio, drop `script`/`style`, truncate ~6000 chars) and ask
  Claude (`askClaude`) to return a strict JSON object of the fields; parse it.
  Parse/validation failure → `parse_failed`.
- The bot-challenge detector currently lives inside `src/scraper/run.ts`
  (`looksLikeBotChallenge`). Export it (or lift it to a shared spot) and reuse it
  here rather than duplicating the string checks.
- The HTML→text cleaning and the JSON parsing are pure functions (no network) so
  they can be unit-tested; the `fetch` + `askClaude` calls are the only I/O.

## API

- `POST /api/listings/extract` — body `{ url }` (zod `extractUrlSchema`,
  `z.string().url()`). Calls `extractListingFromUrl`. Returns
  `{ ok: true, fields }` or `{ ok: false, reason }` with HTTP 200 in both cases
  (a block/parse-miss is a normal outcome the UI handles, not a 500). Malformed
  body → 400.
- `POST /api/listings` (added to the existing GET route) — body validated by
  `addListingSchema` (url + the editable fields). Derives `sourceSite` from the
  URL host (`yad2` / `madlan` / else the hostname). If a listing with that
  `sourceUrl` exists → 409. Scores best-effort via `scoreListing` using the
  current profile's `learnedSummary` (unscored/null on any scoring error, like
  the scraper). Creates the row. Returns `{ listing }` (201).

## UI

- **`/add`** (`app/add/page.tsx`) — gated server component (redirect to
  `/onboarding` if no profile, `force-dynamic`), renders `AddListingForm`.
- **`AddListingForm`** (client) — a URL field + "מלא אוטומטית" button, then the
  editable fields (address, price, rooms, m², floor, four amenity checkboxes,
  description). Auto-fill posts to `/api/listings/extract` and pre-fills on
  `ok`; on `blocked`/`parse_failed`/`fetch_failed` shows a Hebrew note
  ("לא הצלחנו למלא אוטומטית — מלאו ידנית") and leaves the form for manual entry.
  Submit posts to `/api/listings`; on success routes to `/listings/[id]`; on 409
  shows "המודעה כבר קיימת".
- **Nav** — add "הוספה" to the header nav (`Header.tsx`).
- **`SourceLinks`** (`components/SourceLinks.tsx`) — a labeled row
  "מקורות לחיפוש עצמאי" with external links (Yad2 for-sale search, Madlan),
  rendered near the top of the `/listings` page (inside `ListingsClient`).
- **Original link on cards** — `ListingCard` and the dashboard favorite cards
  render "למודעה המקורית ↗" (`<a href={sourceUrl} target="_blank" rel="noopener noreferrer">`).

## Scoring note

`scoreListing(profile, listing)` takes `Pick<PreferenceProfile,"learnedSummary">`
and a `Partial<ParsedListing>`. The create route fetches the current profile row
(for `learnedSummary`) and passes the submitted fields. Wrap in try/catch:
success → `matchScore`/`matchReason`; failure → both null, listing still saved.

## Testing

- Unit (vitest): HTML→text cleaner drops scripts/markup and truncates; the
  extracted-JSON parser accepts a good object and rejects garbage; bot-challenge
  detector returns true on a Radware fixture, false on normal HTML.
- Integration (vitest): `POST /api/listings` — creates a listing (mock
  `scoreListing`/`askClaude` so no network), rejects a duplicate `sourceUrl`
  with 409, 400s on invalid body, derives `sourceSite` from the host.
  `POST /api/listings/extract` — 400 on non-URL body; returns `blocked` on a
  Radware fixture (mock `fetch`).
- E2E (playwright): visit `/add`, fill the form manually, submit, land on the new
  listing's detail page showing the entered address. (Auto-fill path is mocked at
  the unit/integration level, not driven live in e2e, since it depends on the
  network.)

## Sequencing / build order

1. `Listing` type additions + "original" link on cards (small, unblocks A).
2. `SourceLinks` section on `/listings` (B).
3. Extraction lib + `looksLikeBotChallenge` extraction/reuse (unit-tested).
4. `POST /api/listings/extract`.
5. `POST /api/listings` create (+ zod schemas), integration-tested.
6. `/add` page + `AddListingForm` + nav item.
7. E2E for the manual add flow.

Each step leaves the app working.
