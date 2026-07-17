import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

// Repair a malformed/misnamed DATABASE_URL before Prisma reads it (see
// src/lib/database-url.ts). When the env is already valid this is a no-op, so
// local SQLite dev/tests are untouched.
const resolvedUrl = resolveDatabaseUrl();
if (resolvedUrl && resolvedUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
