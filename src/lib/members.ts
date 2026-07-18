import { cookies } from "next/headers";
import { db } from "@/lib/db";

// Lightweight household "who are you" identity — no auth. The active member is
// remembered in a cookie the picker sets client-side; the server reads it to
// attribute added listings and notes.
export const MEMBER_COOKIE = "memberId";

export async function getMembers() {
  return db.member.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createMember(name: string) {
  return db.member.create({ data: { name } });
}

export function getActiveMemberId(): string | null {
  try {
    return cookies().get(MEMBER_COOKIE)?.value ?? null;
  } catch {
    // Called outside a request context (e.g. a unit test) — no active member.
    return null;
  }
}

export async function getActiveMember() {
  const id = getActiveMemberId();
  if (!id) return null;
  return db.member.findUnique({ where: { id } });
}
