// Vercel-build only: rewrite the Prisma datasource provider from sqlite to
// postgresql so PRODUCTION runs on hosted Postgres, while local dev + the test
// suite keep using SQLite (test.db / dev.db) unchanged.
//
// This edits prisma/schema.prisma on the ephemeral Vercel build machine only —
// it must never be run against, or committed from, a local checkout. The repo's
// committed schema stays `provider = "sqlite"`.
import { readFileSync, writeFileSync, existsSync, rmSync, cpSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const src = readFileSync(SCHEMA, "utf8");
const swapped = src.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

if (swapped === src) {
  console.warn("[prepare-prisma-postgres] no sqlite provider found — leaving schema unchanged");
} else {
  writeFileSync(SCHEMA, swapped);
  console.log("[prepare-prisma-postgres] datasource provider set to postgresql for this build");
}

// Swap the SQLite migration set (used by local dev/test) for the Postgres one,
// so `prisma migrate deploy` applies Postgres-dialect SQL against the prod DB.
const PG_MIGRATIONS = "prisma/migrations-pg";
const MIGRATIONS = "prisma/migrations";
if (existsSync(PG_MIGRATIONS)) {
  rmSync(MIGRATIONS, { recursive: true, force: true });
  cpSync(PG_MIGRATIONS, MIGRATIONS, { recursive: true });
  console.log("[prepare-prisma-postgres] swapped in the Postgres migration set");
} else {
  console.warn("[prepare-prisma-postgres] no prisma/migrations-pg found — skipping migration swap");
}
