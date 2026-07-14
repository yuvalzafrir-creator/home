"use client";

import { useState } from "react";

interface ListingNotesProps {
  listingId: string;
  initialNotes: string | null;
}

export function ListingNotes({ listingId, initialNotes }: ListingNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <section className="detail-section">
      <h2>הערות שלי</h2>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="לדוגמה: לתאם ביקור ביום ראשון, לבדוק חניה באזור"
      />
      <div className="notes-actions">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירת הערות"}
        </button>
        {saved && <span className="form-saved">ההערות נשמרו.</span>}
      </div>
    </section>
  );
}
