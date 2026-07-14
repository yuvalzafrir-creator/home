import { NextResponse } from "next/server";
import { extractUrlSchema } from "@/lib/validation";
import { extractListingFromUrl } from "@/lib/extract-listing";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = extractUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // A block/parse-miss is a normal, expected outcome the UI handles — return 200
  // with the result discriminant rather than an error status.
  const result = await extractListingFromUrl(parsed.data.url);
  return NextResponse.json(result);
}
