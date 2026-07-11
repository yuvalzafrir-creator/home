# Home Search Assistant ("מתווך") — Design

## Overview

A personal tool that helps the user and his wife search for a home to buy in Israel. It interviews them about what they want, automatically checks Yad2 (and later Madlan) for matching listings on a schedule, scores each listing against their preferences using Claude, and keeps learning from their feedback over time. All listings are kept so they can be browsed and compared at any point, not just when first found.

## Architecture & Tech Stack

- **Next.js (TypeScript)** — single app serving both the web UI and backend API routes.
- **SQLite via Prisma** — local database, no server to manage.
- **Playwright** — headless-browser scraper for Yad2 (and later Madlan), more resistant to anti-bot blocking than plain HTTP requests.
- **Windows Task Scheduler** — triggers the scraper script once a day, independent of whether the web app is open. Simpler and more reliable than keeping a long-lived Node process running.
- **Claude API** — used for (1) scoring each new listing against the user's preference profile, and (2) periodically rewriting the "learned summary" of the preference profile based on feedback.

**Scraping caveat:** Yad2/Madlan do not officially permit scraping in their terms of use. For personal, non-commercial use the practical risk is low, but the scraper should be gentle — respectful delays between requests, no aggressive parallel hammering — and the system should treat occasional breakage (e.g. after a site redesign) as a normal, recoverable event rather than a crisis.

**Notifications:** explicitly out of scope for now. No WhatsApp/Telegram integration — the web app is the only interface. Can be added later.

## Data Model

- **Listing** — address, price, size (m²), rooms, floor, features (parking, balcony, mamad/safe room, elevator, renovated, etc.), photos, description, source URL, source site, first-seen date, last-seen date, status (active/removed).
- **PreferenceProfile** — structured criteria (location(s), budget, rooms, size, must-have extras, goal: primary residence vs. investment, financials: budget ceiling, open to renting first, open to fixer-uppers and renovation budget) + free-text notes + example listings supplied during onboarding + a "learned summary" paragraph maintained by Claude.
- **Feedback** — like / dislike / note, tied to a listing, timestamped. This is the training signal for the learning loop.
- **ScrapeRun** — timestamp, success/failure, number of new listings found, error details if failed. Powers the health-check UI.

## Learning Loop

1. Onboarding produces PreferenceProfile v1 (see User Flow below for what's asked).
2. Each scheduled scrape run finds new/changed listings; Claude scores each one against the current preference profile, producing a 0–100 match score plus a short explanation.
3. The user reacts to listings (like/dislike/note) in the web app.
4. After every 3 feedback events (or once per day if fewer have accumulated), Claude re-reads the structured criteria, free text, example listings, and recent feedback, and rewrites the "learned summary" — sharpening future scoring without the user having to redo the questionnaire.

## User Flow

1. **Onboarding** (first run): a questionnaire collects —
   - **Examples**: links to homes already seen or considered, liked or disliked, giving the tool concrete reference points from day one.
   - **Areas considered**: specific neighborhoods/places thought about, even tentatively.
   - **Goal**: primary residence (moving in) vs. investment property.
   - **Location & budget**: cities/neighborhoods, price range.
   - **Size & rooms**: square meters, number of rooms, floor, elevator.
   - **Extras**: parking, balcony/porch, mamad/safe room, storage, condition.
   - **Financials**: budget ceiling, whether renting first is on the table, whether they're open to a fixer-upper and roughly how much renovation budget they'd tolerate.
   - **Free text**: anything else in their own words (e.g. "quiet street," "near a park").
2. **Daily feed**: home screen shows new listings from the most recent scrape, sorted by match score (highest first), each with its score and Claude's short "why" explanation.
3. **Reacting**: like, dislike, or leave a note on any listing — feeds the learning loop.
4. **All listings / history**: everything ever found, filterable (e.g. only favorites, only unseen), so nothing is lost over time.
5. **Compare**: select 2–4 listings → **side-by-side table** (rows = attributes like price, size, rooms, score; columns = listings) for scanning exact differences.
6. **Health check**: a status line showing when the last scrape ran and whether it succeeded.

## Error Handling

- **Scraper breaks** (site layout change or blocking): the run fails gracefully, logs the error to ScrapeRun, and the dashboard reflects "last successful scrape: N days ago" — nothing crashes.
- **Claude scoring fails**: the listing is saved as "unscored" and retried on the next run rather than blocking the whole batch.
- **Duplicate listings**: matched by source URL, so re-appearing listings don't spam the feed as "new."
- **Malformed listing data** (missing price, broken photo, etc.): skipped and logged rather than crashing the scrape.

## Testing Plan

- **Unit tests**: scraper parsing (price/rooms/size/floor/features extraction from saved Yad2 HTML fixtures), dedup logic, preference-profile merge logic.
- **Integration tests**: full pipeline (scrape → dedup → score → save) run against fixture HTML and a mocked Claude API.
- **API route tests**: onboarding submission, feedback submission, compare endpoint — verifying correct data lands in the DB.
- **End-to-end tests** (Playwright against the actual UI): onboarding wizard, viewing the feed, liking a listing, building a compare view.
- **Regression fixtures**: sanitized real snapshots of Yad2's listing page HTML, so scraper test failures reliably signal "Yad2 changed their site" rather than a code regression.

## Out of Scope (for now)

- WhatsApp/Telegram notifications.
- Madlan scraping (Yad2 only for v1; Madlan can be added the same way later).
- Cloud hosting/deployment — this runs locally for now (see Approach B in the original discussion for a future path).
