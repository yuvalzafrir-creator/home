import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSchema } from "@/lib/validation";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "שם משפחה או סיסמה שגויים" }, { status: 401 });
  }

  const household = await db.household.findUnique({ where: { name: parsed.data.name } });
  if (!household || !verifyPassword(parsed.data.password, household.passwordHash)) {
    return NextResponse.json({ error: "שם משפחה או סיסמה שגויים" }, { status: 401 });
  }

  setSessionCookie(household.id);
  return NextResponse.json({ ok: true });
}
