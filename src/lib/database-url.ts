// Resolves a usable database connection string from the environment at
// runtime, tolerating the common misconfigurations Vercel storage
// integrations produce: a custom-prefixed variable name (e.g.
// DATABASE_URL_POSTGRES_URL), stray wrapping quotes, whitespace, or a whole
// `NAME="..."` line pasted as the value. Mirrors scripts/vercel-build.mjs,
// which does the same for build-time prisma commands.

const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_POSTGRES_PRISMA_URL",
  "DATABASE_URL_POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
];

export function cleanDatabaseUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  let s = value.trim();
  const quoted =
    (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"));
  if (quoted) s = s.slice(1, -1).trim();
  // A whole env line pasted as the value, e.g. POSTGRES_URL="postgres://..."
  s = s.replace(/^[A-Z_]+=["']?/, "").replace(/["']$/, "");
  return s || null;
}

// file: is allowed only via DATABASE_URL itself (local SQLite dev/tests);
// fallback candidates must be real Postgres URLs.
const PRIMARY_VALID = /^(postgres(ql)?:\/\/|file:)/i;
const FALLBACK_VALID = /^postgres(ql)?:\/\//i;

export function resolveDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  for (const name of CANDIDATES) {
    const cleaned = cleanDatabaseUrl(env[name]);
    if (!cleaned) continue;
    const valid = name === "DATABASE_URL" ? PRIMARY_VALID : FALLBACK_VALID;
    if (valid.test(cleaned)) return cleaned;
  }
  return null;
}
