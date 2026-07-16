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
      // Only follow internal paths — never an external URL from model output.
      if (a.type === "navigate" && a.path && a.path.startsWith("/") && !a.path.startsWith("//")) {
        router.push(a.path);
      } else if (a.type === "setListingFilter" && a.filter) {
        router.push(`/listings?filter=${encodeURIComponent(a.filter)}`);
      }
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
