import { NextResponse } from "next/server";
import { getClaudeClient } from "@/lib/claude";
import { profilePatchSchema } from "@/lib/validation";
import { patchProfile } from "@/lib/profile";

const SYSTEM = `אתה העוזר של HomeScout, אפליקציה לחיפוש דירה. ענה תמיד בעברית, בקצרה וידידותית.
אתה יכול לעדכן את ההעדפות השמורות של המשתמש, לנווט באפליקציה, ולסנן מודעות — באמצעות הכלים שניתנו לך.
לאחר שימוש בכלי, אשר בקצרה בעברית מה עשית.
עמודי האפליקציה: לוח בקרה (/), מודעות (/listings), מפה (/map), השוואה (/compare), פרופיל (/profile), הוספת מודעה (/add).`;

const tools = [
  {
    name: "updateProfile",
    description: "Update the user's saved home-search preferences. Include only the fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        locations: { type: "array", items: { type: "string" } },
        budgetMax: { type: "number" },
        minRooms: { type: "number" },
        minSizeSqm: { type: "number" },
        mustHaveExtras: { type: "array", items: { type: "string" } },
        goal: { type: "string", enum: ["primary", "investment"] },
        openToRenting: { type: "boolean" },
        openToFixerUpper: { type: "boolean" },
        renovationBudget: { type: "number" },
        freeText: { type: "string" },
      },
    },
  },
  {
    name: "navigate",
    description: "Navigate the app to a page. Valid paths: /, /listings, /map, /compare, /profile, /add.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "setListingFilter",
    description: "Filter the listings page. filter is one of: all, favorites, unseen.",
    input_schema: {
      type: "object" as const,
      properties: { filter: { type: "string", enum: ["all", "favorites", "unseen"] } },
      required: ["filter"],
    },
  },
];

const CLIENT_TOOLS = new Set(["navigate", "setListingFilter"]);

export async function POST(req: Request) {
  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const client = getClaudeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = body.messages.map((m) => ({ role: m.role, content: m.content }));
  const actions: { type: string; [k: string]: unknown }[] = [];
  let reply = "";

  // Permissive block shape — avoids narrowing the SDK's ContentBlock union at
  // every access (tool_use blocks always carry id/name/input; text blocks text).
  type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown };

  try {
    for (let i = 0; i < 6; i++) {
      const res = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages,
      });

      const content = res.content as unknown as Block[];
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");

      if (res.stop_reason !== "tool_use") {
        reply = text;
        break;
      }

      messages.push({ role: "assistant", content: res.content });
      const toolResults: unknown[] = [];
      for (const block of content) {
        if (block.type !== "tool_use") continue;
        if (block.name === "updateProfile") {
          const parsed = profilePatchSchema.safeParse(block.input);
          let result = "השדות אינם תקינים";
          if (parsed.success) {
            const updated = await patchProfile(parsed.data);
            result = updated ? "ההעדפות עודכנו" : "אין פרופיל לעדכן";
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } else if (block.name && CLIENT_TOOLS.has(block.name)) {
          actions.push({ type: block.name, ...(block.input as Record<string, unknown>) });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "done" });
        } else {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "unknown tool", is_error: true });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("assistant route error:", err);
    return NextResponse.json({ reply: "מצטער, העוזר אינו זמין כרגע. נסו שוב מאוחר יותר.", actions: [] });
  }

  return NextResponse.json({ reply, actions });
}
