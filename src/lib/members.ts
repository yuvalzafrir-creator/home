import { cookies } from "next/headers";
import { db } from "@/lib/db";

// Which household member (attribution) is "you" on this device — no auth, just a
// picker stored in a cookie. Always resolved against the signed-in household so
// a tampered cookie can never attribute to another household's member.
export const MEMBER_COOKIE = "memberId";

export async function getMembers(householdId: string) {
  return db.member.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } });
}

export async function createMember(householdId: string, name: string) {
  return db.member.create({ data: { householdId, name } });
}

function activeMemberCookie(): string | null {
  try {
    return cookies().get(MEMBER_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// The active member's id, but only if it belongs to this household — else null.
export async function resolveActiveMemberId(householdId: string): Promise<string | null> {
  const id = activeMemberCookie();
  if (!id) return null;
  const member = await db.member.findFirst({
    where: { id, householdId },
    select: { id: true },
  });
  return member ? member.id : null;
}
