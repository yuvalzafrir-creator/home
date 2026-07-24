import { NextResponse } from "next/server";
import { z } from "zod";
import { getMembers, createMember } from "@/lib/members";
import { getSessionHouseholdId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ members: await getMembers(householdId) });
}

const schema = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(req: Request) {
  const householdId = getSessionHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const member = await createMember(householdId, parsed.data.name);
  return NextResponse.json({ member }, { status: 201 });
}
