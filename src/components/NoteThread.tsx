"use client";

import { useState } from "react";

export interface ThreadNote {
  id: string;
  text: string;
  createdAt: string;
  member: { name: string } | null;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NoteThread({ listingId, initial }: { listingId: string; initial: ThreadNote[] }) {
  const [notes, setNotes] = useState<ThreadNote[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const res = await fetch(`/api/listings/${listingId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setNotes((n) => [...n, data.note]);
      setText("");
    }
  }

  return (
    <section className="detail-section">
      <h2>הערות</h2>
      {notes.length > 0 ? (
        <ul className="note-thread">
          {notes.map((n) => (
            <li className="note" key={n.id}>
              <div className="note__head">
                <span className="note__author">{n.member?.name ?? "לא ידוע"}</span>
                <span className="note__date">{when(n.createdAt)}</span>
              </div>
              <p className="note__text">{n.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note-thread__empty">עדיין אין הערות. הוסיפו את הראשונה.</p>
      )}
      <form className="note-add" onSubmit={add}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="הוסיפו הערה…"
          aria-label="הוספת הערה"
        />
        <button type="submit" className="btn-primary" disabled={busy || !text.trim()}>
          {busy ? "מוסיף…" : "הוספת הערה"}
        </button>
      </form>
    </section>
  );
}
