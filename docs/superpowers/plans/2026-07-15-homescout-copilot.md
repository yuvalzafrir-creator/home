# HomeScout AI Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating AI copilot on every screen that answers questions and takes action — updating the user's saved preferences, navigating the app, and filtering listings — via Claude tool-calling.

**Architecture:** A client `Copilot` chat component (floating bubble + panel) in the root layout POSTs the conversation to `/api/assistant`, which runs a Claude tool-use loop. Server-side tools (`updateProfile`) hit the DB directly; client-side tools (`navigate`, `setListingFilter`) can't run on the server, so they're acknowledged in the loop and returned as `actions` the chat component performs (router push / filter). All tools touch only the user's own data or navigation, so they apply directly (matches the spec's safety analysis).

**Tech Stack:** Next.js 14 (App Router), React 18, Prisma + SQLite, `@anthropic-ai/sdk`, Zod, Vitest, Playwright.

**Scope note:** Final phase of the redesign (spec: `docs/superpowers/specs/2026-07-13-homescout-redesign-design.md`, copilot section). v1 tools = navigate + updateProfile + setListingFilter (the user's stated "navigate, edit profile, filter listings"). `openListing`/`addNote` are deferred (they need per-listing context/ids).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/profile.ts` | `patchProfile` partial update | Modify |
| `src/lib/validation.ts` | `profilePatchSchema` | Modify |
| `src/app/api/assistant/route.ts` | Claude tool-use loop | Create |
| `src/components/Copilot.tsx` | Floating chat (client) | Create |
| `src/app/layout.tsx` | Mount `<Copilot />` | Modify |
| `src/app/globals.css` | Copilot styles | Modify |
| `src/app/listings/page.tsx` | Wrap client in `<Suspense>` | Modify |
| `src/app/listings/ListingsClient.tsx` | Honor `?filter` query | Modify |
| `tests/integration/profile-patch.test.ts` | patchProfile coverage | Create |
| `tests/integration/assistant-route.test.ts` | Tool-loop (mocked Claude) | Create |
| `tests/e2e/copilot.spec.ts` | Chat UI + action (mocked API) | Create |

---

## Task 1: `patchProfile` + schema

**Files:** Modify `src/lib/profile.ts`, `src/lib/validation.ts`; Test `tests/integration/profile-patch.test.ts`

- [ ] **Step 1: Add the patch schema** — append to `src/lib/validation.ts`:

```ts
export const profilePatchSchema = z.object({
  locations: z.array(z.string()).min(1).optional(),
  budgetMax: z.number().int().positive().optional(),
  minRooms: z.number().positive().nullable().optional(),
  minSizeSqm: z.number().int().positive().nullable().optional(),
  mustHaveExtras: z.array(z.string()).optional(),
  goal: z.enum(["primary", "investment"]).optional(),
  openToRenting: z.boolean().optional(),
  openToFixerUpper: z.boolean().optional(),
  renovationBudget: z.number().int().nonnegative().nullable().optional(),
  freeText: z.string().nullable().optional(),
});

export type ProfilePatch = z.infer<typeof profilePatchSchema>;
```

- [ ] **Step 2: Write the failing test** — `tests/integration/profile-patch.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { patchProfile } from "@/lib/profile";
import { db } from "@/lib/db";

async function seedProfile() {
  return db.preferenceProfile.create({
    data: {
      locations: JSON.stringify(["Tel Aviv"]),
      budgetMax: 2500000,
      mustHaveExtras: JSON.stringify(["mamad"]),
      goal: "primary",
      exampleUrls: JSON.stringify([]),
    },
  });
}

describe("patchProfile", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
  });

  it("updates only the provided fields and parses arrays back", async () => {
    await seedProfile();
    const updated = await patchProfile({ budgetMax: 3200000, mustHaveExtras: ["mamad", "parking"] });
    expect(updated).not.toBeNull();
    expect(updated!.budgetMax).toBe(3200000);
    expect(updated!.mustHaveExtras).toEqual(["mamad", "parking"]);
    // untouched field preserved
    expect(updated!.locations).toEqual(["Tel Aviv"]);
  });

  it("returns null when no profile exists", async () => {
    expect(await patchProfile({ budgetMax: 1 })).toBeNull();
  });
});
```

- [ ] **Step 3: Run it, verify it FAILS** — `npx vitest run tests/integration/profile-patch.test.ts` → FAIL (`patchProfile` not exported).

- [ ] **Step 4: Implement `patchProfile`** — in `src/lib/profile.ts`, add the import of the type and the function (keep `getProfile`/`ProfileData` as-is). Add at the top with the existing import:

```ts
import type { ProfilePatch } from "@/lib/validation";
```

Add at the end of the file:

```ts
// Partial update of the single profile. Only keys present in `patch` are
// written; array fields are re-serialized to JSON strings. Returns the parsed
// updated profile, or null if onboarding hasn't happened yet.
export async function patchProfile(patch: ProfilePatch): Promise<ProfileData | null> {
  const existing = await db.preferenceProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.locations !== undefined) data.locations = JSON.stringify(patch.locations);
  if (patch.budgetMax !== undefined) data.budgetMax = patch.budgetMax;
  if (patch.minRooms !== undefined) data.minRooms = patch.minRooms;
  if (patch.minSizeSqm !== undefined) data.minSizeSqm = patch.minSizeSqm;
  if (patch.mustHaveExtras !== undefined) data.mustHaveExtras = JSON.stringify(patch.mustHaveExtras);
  if (patch.goal !== undefined) data.goal = patch.goal;
  if (patch.openToRenting !== undefined) data.openToRenting = patch.openToRenting;
  if (patch.openToFixerUpper !== undefined) data.openToFixerUpper = patch.openToFixerUpper;
  if (patch.renovationBudget !== undefined) data.renovationBudget = patch.renovationBudget;
  if (patch.freeText !== undefined) data.freeText = patch.freeText;

  await db.preferenceProfile.update({ where: { id: existing.id }, data });
  return getProfile();
}
```

- [ ] **Step 5: Run tests + typecheck** — `npx vitest run tests/integration/profile-patch.test.ts` → PASS (2). `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/profile.ts src/lib/validation.ts tests/integration/profile-patch.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: patchProfile partial-update helper"
```

---

## Task 2: `/api/assistant` tool-use loop

**Files:** Create `src/app/api/assistant/route.ts`, `tests/integration/assistant-route.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/integration/assistant-route.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

// Fake Anthropic client: first call asks to updateProfile, second returns text.
const create = vi.fn();
vi.mock("@/lib/claude", () => ({
  getClaudeClient: () => ({ messages: { create } }),
}));

import { POST } from "@/app/api/assistant/route";
import { db } from "@/lib/db";

function req(messages: unknown) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

describe("POST /api/assistant", () => {
  afterEach(async () => {
    await db.preferenceProfile.deleteMany();
    create.mockReset();
  });

  it("runs a tool-use loop: updateProfile then a final reply", async () => {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 2500000,
        mustHaveExtras: JSON.stringify([]),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });

    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "updateProfile", input: { budgetMax: 3000000 } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "עדכנתי את התקציב ל־3,000,000 ₪." }],
      });

    const res = await POST(req([{ role: "user", content: "תעלה את התקציב ל־3 מיליון" }]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reply).toContain("3,000,000");
    const profile = await db.preferenceProfile.findFirst();
    expect(profile!.budgetMax).toBe(3000000);
  });

  it("returns client actions for navigate without executing server-side", async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "n1", name: "navigate", input: { path: "/map" } }],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "פתחתי את המפה." }],
      });

    const res = await POST(req([{ role: "user", content: "תפתח את המפה" }]));
    const body = await res.json();

    expect(body.actions).toEqual([{ type: "navigate", path: "/map" }]);
  });

  it("returns a friendly message when the model call throws", async () => {
    create.mockRejectedValueOnce(new Error("no api key"));
    const res = await POST(req([{ role: "user", content: "hi" }]));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toBeTruthy();
    expect(body.actions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS** — `npx vitest run tests/integration/assistant-route.test.ts` → FAIL (route missing).

- [ ] **Step 3: Implement the route** — `src/app/api/assistant/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests + typecheck** — `npx vitest run tests/integration/assistant-route.test.ts` → PASS (3). `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assistant/route.ts tests/integration/assistant-route.test.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: /api/assistant Claude tool-use loop"
```

---

## Task 3: `Copilot` chat component

**Files:** Create `src/components/Copilot.tsx`; Modify `src/app/globals.css`

- [ ] **Step 1: Create `src/components/Copilot.tsx`:**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Action {
  type: string;
  path?: string;
  filter?: string;
}

export function Copilot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function runActions(actions: Action[]) {
    for (const a of actions) {
      if (a.type === "navigate" && a.path) router.push(a.path);
      else if (a.type === "setListingFilter" && a.filter) router.push(`/listings?filter=${a.filter}`);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
      if (Array.isArray(data.actions)) runActions(data.actions);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "משהו השתבש. נסו שוב." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight));
    }
  }

  return (
    <>
      <button
        className="copilot-fab"
        aria-label={open ? "סגירת העוזר" : "פתיחת העוזר"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "×" : "💬"}
      </button>

      {open && (
        <div className="copilot-panel" role="dialog" aria-label="עוזר HomeScout">
          <div className="copilot-header">עוזר HomeScout</div>
          <div className="copilot-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="copilot-hint">
                אפשר לבקש: &quot;תעלה את התקציב ל־3 מיליון&quot;, &quot;תפתח את המפה&quot;, &quot;תראה לי מועדפים&quot;.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`copilot-msg copilot-msg--${m.role}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="copilot-msg copilot-msg--assistant copilot-typing">…</div>}
          </div>
          <form
            className="copilot-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="במה אפשר לעזור?"
              aria-label="הודעה לעוזר"
            />
            <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
              שליחה
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Styles** — append to `src/app/globals.css`:

```css
/* ---------- Copilot ---------- */
.copilot-fab {
  position: fixed;
  bottom: 20px;
  inset-inline-start: 20px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 22px;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-md);
  z-index: 40;
}
.copilot-fab:hover:not(:disabled) {
  background: var(--accent-hover);
}

.copilot-panel {
  position: fixed;
  bottom: 84px;
  inset-inline-start: 20px;
  width: min(360px, calc(100vw - 40px));
  height: min(520px, calc(100vh - 120px));
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 40;
  overflow: hidden;
}

.copilot-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 14px;
}

.copilot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.copilot-hint {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.copilot-msg {
  max-width: 85%;
  padding: 9px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.copilot-msg--user {
  align-self: flex-start;
  background: var(--accent-soft);
  color: var(--text);
}
.copilot-msg--assistant {
  align-self: flex-end;
  background: var(--surface-muted);
  color: var(--text);
}
.copilot-typing {
  color: var(--text-muted);
}

.copilot-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-direction: row;
}
.copilot-input input {
  flex: 1;
  width: auto;
}
.copilot-input button {
  flex: none;
}
```

Note: `.copilot-msg--user` is aligned to the flex-start (right in RTL) and the assistant to the end (left), giving the familiar two-sided chat layout in RTL.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/Copilot.tsx src/app/globals.css
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: Copilot floating chat component"
```

---

## Task 4: Mount copilot + honor `?filter`

**Files:** Modify `src/app/layout.tsx`, `src/app/listings/page.tsx`, `src/app/listings/ListingsClient.tsx`

- [ ] **Step 1: Mount `<Copilot />` in the layout**

In `src/app/layout.tsx`, add the import:
```tsx
import { Copilot } from "@/components/Copilot";
```
Then render it inside `<body>`, after `{children}`:
```tsx
        {children}
        <Copilot />
```

- [ ] **Step 2: Wrap the listings client in Suspense**

`ListingsClient` will call `useSearchParams` (Step 3), which Next requires inside a Suspense boundary. In `src/app/listings/page.tsx`, add `import { Suspense } from "react";` and wrap the client:
```tsx
  return (
    <Suspense>
      <ListingsClient />
    </Suspense>
  );
```
(Keep the `getProfile` gate + `force-dynamic` above it exactly as they are.)

- [ ] **Step 3: Honor the `?filter` query in `ListingsClient`**

In `src/app/listings/ListingsClient.tsx`:
(a) Add `useSearchParams` to the next/navigation import (add the import if not present):
```tsx
import { useSearchParams } from "next/navigation";
```
(b) Read the param and initialize/sync `filter`. Replace the `const [filter, setFilter] = useState<FilterOption>("all");` line with:
```tsx
  const searchParams = useSearchParams();
  const paramFilter = searchParams.get("filter");
  const initialFilter: FilterOption =
    paramFilter === "favorites" || paramFilter === "unseen" ? paramFilter : "all";
  const [filter, setFilter] = useState<FilterOption>(initialFilter);
```
(c) Add an effect (next to the other hooks) so the copilot's `setListingFilter` (which pushes `/listings?filter=…`) updates the view while the page is already mounted:
```tsx
  useEffect(() => {
    if (paramFilter === "favorites" || paramFilter === "unseen" || paramFilter === "all") {
      setFilter(paramFilter);
    }
  }, [paramFilter]);
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` → clean. `npx next build 2>&1 | tail -20` → builds; `/listings` still compiles (Suspense + useSearchParams fine because the route is `force-dynamic`).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/listings/page.tsx src/app/listings/ListingsClient.tsx
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "feat: mount copilot globally and sync listings filter to URL"
```

---

## Task 5: E2E — copilot chat + action (mocked API)

**Files:** Create `tests/e2e/copilot.spec.ts`

- [ ] **Step 1: Create `tests/e2e/copilot.spec.ts`** — intercept `/api/assistant` so the test needs no live Claude key:

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

if (!process.env.DATABASE_URL?.includes("dev.db")) {
  throw new Error(
    `tests/e2e/copilot.spec.ts: DATABASE_URL does not point at dev.db (got: ${process.env.DATABASE_URL}). Refusing to run against an unexpected database.`
  );
}

const db = new PrismaClient();

test.describe("copilot", () => {
  let createdProfileId: string | null = null;

  test.beforeEach(async () => {
    const anyProfile = await db.preferenceProfile.findFirst();
    if (!anyProfile) {
      const created = await db.preferenceProfile.create({
        data: {
          locations: JSON.stringify(["Tel Aviv"]),
          budgetMax: 3000000,
          mustHaveExtras: JSON.stringify([]),
          goal: "primary",
          exampleUrls: JSON.stringify([]),
        },
      });
      createdProfileId = created.id;
    } else {
      createdProfileId = null;
    }
  });

  test.afterEach(async () => {
    if (createdProfileId) {
      await db.preferenceProfile.delete({ where: { id: createdProfileId } });
      createdProfileId = null;
    }
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("chats and performs a navigate action", async ({ page }) => {
    await page.route("**/api/assistant", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "פתחתי את המפה.", actions: [{ type: "navigate", path: "/map" }] }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "פתיחת העוזר" }).click();
    await page.getByLabel("הודעה לעוזר").fill("תפתח את המפה");
    await page.getByRole("button", { name: "שליחה", exact: true }).click();

    await expect(page.getByText("פתחתי את המפה.")).toBeVisible();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.locator("h1")).toHaveText("מפה");
  });
});
```

- [ ] **Step 2: Run it** — `npx playwright test tests/e2e/copilot.spec.ts` → PASS. (Stale `.next`/port-3000 recovery as in other specs if needed.)

- [ ] **Step 3: Full suites** — `npx vitest run` → all pass. `npx playwright test` → all specs pass (6 including copilot).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/copilot.spec.ts
git -c user.email="yuvalzafrir@gmail.com" -c user.name="Yuval Zafrir" commit -m "test: e2e for the copilot chat and navigate action"
```

---

## Done criteria

- A floating copilot bubble on every screen opens a Hebrew chat panel.
- Asking it to change a preference updates the saved profile (`updateProfile` tool → DB); asking it to navigate or filter performs the client action.
- No live Claude key present → the endpoint returns a friendly Hebrew fallback rather than 500.
- `npx vitest run` and `npx playwright test` both green.
- Copilot behavior confirmed in the browser by the controller (with a key, or via the mocked path).
