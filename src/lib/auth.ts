import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "session";
// Set SESSION_SECRET in production (Vercel env). The dev fallback is only for
// local development and must never be relied on in production.
const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  // Fail loudly in logs: sessions signed with the public fallback are forgeable.
  console.warn(
    "[auth] SESSION_SECRET is not set in production — sessions are signed with a " +
      "public dev secret and can be forged. Set SESSION_SECRET in the environment."
  );
}

// ---------- password hashing (scrypt, salted) ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---------- signed session token ----------
function sign(householdId: string): string {
  const sig = createHmac("sha256", SECRET).update(householdId).digest("hex");
  return `${householdId}.${sig}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(createHmac("sha256", SECRET).update(id).digest("hex"));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return id;
}

export function setSessionCookie(householdId: string): void {
  cookies().set(SESSION_COOKIE, sign(householdId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

// The authenticated household's id, or null. Safe to call anywhere (returns
// null outside a request context / on a missing or tampered cookie).
export function getSessionHouseholdId(): string | null {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    return token ? verify(token) : null;
  } catch {
    return null;
  }
}
