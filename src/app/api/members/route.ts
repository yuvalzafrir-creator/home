import { NextResponse } from "next/server";
import { z } from "zod";
import { getMembers, createMember } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ members: await getMembers() });
}

const schema = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(req: Request) {
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
  const member = await createMember(parsed.data.name);
  return NextResponse.json({ member }, { status: 201 });
}
