// Vercel-build only: rewrite the Prisma datasource provider from sqlite to
// postgresql so PRODUCTION runs on hosted Postgres, while local dev + the test
// suite keep using SQLite (test.db / dev.db) unchanged.
//
// This edits prisma/schema.prisma on the ephemeral Vercel build machine only —
// it must never be run against, or committed from, a local checkout. The repo's
// committed schema stays `provider = "sqlite"`.
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const src = readFileSync(SCHEMA, "utf8");
const swapped = src.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

if (swapped === src) {
  console.warn("[prepare-prisma-postgres] no sqlite provider found — leaving schema unchanged");
} else {
  writeFileSync(SCHEMA, swapped);
  console.log("[prepare-prisma-postgres] datasource provider set to postgresql for this build");
}
