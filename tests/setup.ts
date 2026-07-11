import { config } from "dotenv";
import path from "node:path";

// Point tests at a dedicated SQLite database (prisma/test.db) instead of the
// real dev database (prisma/dev.db) used by `npm run dev`. Without this,
// integration tests (e.g. tests/integration/onboarding-route.test.ts) would
// read/write/clear rows in the same database the dev server uses.
//
// override: true is required — dotenv's config() does NOT override a
// DATABASE_URL that's already set in process.env (e.g. from a shell
// profile, CI, or another tool run first). Without override, a
// pre-existing DATABASE_URL pointing at dev.db would silently win and
// tests would wipe the real dev database.
//
// NOTE: the test database schema is NOT created automatically. After
// cloning or after a schema change, run:
//   DATABASE_URL="file:./test.db" npx prisma migrate deploy
// (from the project root) to apply migrations to prisma/test.db.
config({ path: path.resolve(__dirname, "../.env.test"), override: true });

// Fail fast rather than silently running tests (and their table-wiping
// afterEach hooks) against whatever database DATABASE_URL happens to
// point at.
if (!process.env.DATABASE_URL?.includes("test.db")) {
  throw new Error(
    `tests/setup.ts: DATABASE_URL does not point at test.db (got: ${process.env.DATABASE_URL}). Refusing to run tests against a database that might be the real dev DB.`
  );
}
