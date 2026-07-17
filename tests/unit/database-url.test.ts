import { describe, it, expect } from "vitest";
import { cleanDatabaseUrl, resolveDatabaseUrl } from "@/lib/database-url";

describe("cleanDatabaseUrl", () => {
  it("strips wrapping quotes and whitespace", () => {
    expect(cleanDatabaseUrl(' "postgres://u:p@h/db" ')).toBe("postgres://u:p@h/db");
    expect(cleanDatabaseUrl("'postgres://u:p@h/db'")).toBe("postgres://u:p@h/db");
  });

  it("strips a pasted NAME= prefix", () => {
    expect(cleanDatabaseUrl('POSTGRES_URL="postgres://u:p@h/db"')).toBe("postgres://u:p@h/db");
  });

  it("passes clean values through unchanged", () => {
    expect(cleanDatabaseUrl("file:./dev.db")).toBe("file:./dev.db");
  });
});

describe("resolveDatabaseUrl", () => {
  it("keeps a valid DATABASE_URL as-is (local sqlite)", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "file:./dev.db" })).toBe("file:./dev.db");
  });

  it("repairs a quoted DATABASE_URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: '"postgres://u:p@h/db"' })).toBe(
      "postgres://u:p@h/db"
    );
  });

  it("falls back to a prefixed integration variable", () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL_POSTGRES_URL: "postgres://u:p@h/db" })
    ).toBe("postgres://u:p@h/db");
  });

  it("never uses file: from a fallback variable", () => {
    expect(resolveDatabaseUrl({ POSTGRES_URL: "file:./x.db" })).toBeNull();
  });

  it("returns null when nothing usable exists", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "prisma+postgres://x" })).toBeNull();
    expect(resolveDatabaseUrl({})).toBeNull();
  });
});
