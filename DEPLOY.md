# Deploying HomeScout to Vercel + Postgres

The app runs on **SQLite locally** (and in the test suite) and on **hosted
Postgres in production**. The Vercel build swaps the Prisma provider
automatically — you don't edit the schema.

## What only you can do

These steps require your accounts / secrets and can't be automated for you:

- Create the GitHub repo, Vercel account, and Postgres database.
- Paste your `ANTHROPIC_API_KEY` and the Postgres `DATABASE_URL` into Vercel.
- Approve Vercel's GitHub authorization and any provider terms.

## 1. Push the code to GitHub

This repo has no remote yet. Create an empty GitHub repo, then:

```bash
git remote add origin https://github.com/<you>/homescout.git
git push -u origin main
```

(SQLite files and `.env` are gitignored, so no data or secrets go up.)

## 2. Create a Postgres database

Easiest is **Vercel Postgres** (or **Neon** — free tier is fine):

- Vercel Postgres: in your Vercel project → **Storage → Create → Postgres**.
  Vercel injects `DATABASE_URL` (and friends) automatically.
- Neon: create a project at neon.tech, copy the **pooled** connection string
  (it looks like `postgresql://user:pass@…-pooler.neon.tech/db?sslmode=require`).

## 3. Import the project into Vercel

- Vercel → **Add New → Project** → import your GitHub repo.
- Framework preset: **Next.js** (auto-detected).
- **Build command:** leave default — Vercel runs the `vercel-build` script in
  `package.json`, which swaps Prisma to Postgres, applies the versioned
  migrations (`prisma migrate deploy`), and builds.

## 4. Set environment variables

In the Vercel project → **Settings → Environment Variables**, add (Production +
Preview):

| Name | Value |
|------|-------|
| `DATABASE_URL` | your Postgres connection string (skip if using Vercel Postgres — it's injected) |
| `ANTHROPIC_API_KEY` | your Anthropic API key |

## 5. Deploy

Trigger a deploy (push to `main`, or **Redeploy** in Vercel). On build, Vercel:

1. installs deps (`postinstall` → `prisma generate`),
2. runs `vercel-build`: swap provider + Postgres migration set →
   `prisma generate` → `prisma migrate deploy` (creates the tables in your
   Postgres) → `next build`.

First load will hit the onboarding gate (empty DB) — fill the form and you're in.

## Notes

- **Data does not migrate** from local SQLite; production starts empty. That's
  intended (local data was demo/test data).
- **Scraping / geocoding backfill** (`npm run scrape`, `npm run geocode`) are
  manual/local tools — they don't run on Vercel. To geocode production listings,
  run `npm run geocode` locally against the production `DATABASE_URL`, or wire it
  into a scheduled job later.
- **Schema changes / migrations:** production uses versioned migrations
  (`prisma migrate deploy`). The Postgres migration set lives in
  `prisma/migrations-pg/` and is swapped into place at build time; local
  dev/test keep their own SQLite migrations in `prisma/migrations/`. When you
  change `prisma/schema.prisma`, add a new SQL migration under
  `prisma/migrations-pg/<name>/migration.sql` (generate it with
  `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`)
  so prod and local stay in sync.
- The provider + migration swap is build-only
  (`scripts/prepare-prisma-postgres.mjs`); the committed
  `prisma/schema.prisma` stays `sqlite` so local dev and `npm test` are
  unaffected.
