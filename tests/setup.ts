import { config } from "dotenv";
import path from "node:path";

// Point tests at a dedicated SQLite database (prisma/test.db) instead of the
// real dev database (prisma/dev.db) used by `npm run dev`. Without this,
// integration tests (e.g. tests/integration/onboarding-route.test.ts) would
// read/write/clear rows in the same database the dev server uses.
//
// NOTE: the test database schema is NOT created automatically. After
// cloning or after a schema change, run:
//   DATABASE_URL="file:./test.db" npx prisma migrate deploy
// (from the project root) to apply migrations to prisma/test.db.
config({ path: path.resolve(__dirname, "../.env.test") });
