// Vercel build entrypoint. Resolves the Postgres connection string from any of
// the env-var names the various Vercel storage integrations create (with or
// without a custom prefix), cleans it up (stray quotes / whitespace / a pasted
// NAME= prefix), and runs the build steps with DATABASE_URL set to the result.
import { spawnSync } from "node:child_process";

const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_POSTGRES_PRISMA_URL",
  "DATABASE_URL_POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
];

function clean(value) {
  if (!value) return null;
  let s = value.trim();
  const quoted =
    (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"));
  if (quoted) s = s.slice(1, -1).trim();
  // A whole env line pasted as the value, e.g. POSTGRES_URL="postgres://..."
  s = s.replace(/^[A-Z_]+=["']?/, "").replace(/["']$/, "");
  return s;
}

let resolved = null;
let source = null;
for (const name of CANDIDATES) {
  const s = clean(process.env[name]);
  if (s && /^postgres(ql)?:\/\//i.test(s)) {
    resolved = s;
    source = name;
    break;
  }
}

if (!resolved) {
  console.error(
    "[vercel-build] No usable Postgres connection string found. Checked env vars:"
  );
  for (const name of CANDIDATES) {
    const raw = process.env[name];
    if (!raw) continue;
    // Log only the protocol part — never credentials.
    const s = clean(raw) ?? "";
    const proto = s.includes("://") ? s.slice(0, s.indexOf("://") + 3) : "(no protocol)";
    console.error(`  - ${name}: starts with "${proto}"`);
  }
  console.error(
    "[vercel-build] Connect a Postgres database to the project (Storage tab) or set DATABASE_URL to a postgres:// connection string."
  );
  process.exit(1);
}

console.log(`[vercel-build] using Postgres connection string from ${source}`);

const env = { ...process.env, DATABASE_URL: resolved };
const steps = [
  "node scripts/prepare-prisma-postgres.mjs",
  "npx prisma generate",
  "npx prisma migrate deploy",
  "npx prisma db seed",
  "npx next build",
];

for (const cmd of steps) {
  console.log(`[vercel-build] $ ${cmd}`);
  const res = spawnSync(cmd, { stdio: "inherit", shell: true, env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
