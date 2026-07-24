import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSchema } from "@/lib/validation";
import { hashPassword, setSessionCookie } from "@/lib/auth";

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
    return NextResponse.json({ error: "שם משפחה נדרש וסיסמה באורך 6 תווים לפחות" }, { status: 400 });
  }

  const existing = await db.household.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "שם המשפחה כבר תפוס" }, { status: 409 });
  }

  const household = await db.household.create({
    data: { name: parsed.data.name, passwordHash: hashPassword(parsed.data.password) },
  });
  setSessionCookie(household.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}
