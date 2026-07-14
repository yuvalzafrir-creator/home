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
  const [error, setError] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) setSaved(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="detail-section">
      <h2>הערות שלי</h2>
      <textarea
        aria-label="הערות שלי"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
          setError(false);
        }}
        placeholder="לדוגמה: לתאם ביקור ביום ראשון, לבדוק חניה באזור"
      />
      <div className="notes-actions">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירת הערות"}
        </button>
        {saved && <span className="form-saved">ההערות נשמרו.</span>}
        {error && <span role="alert" className="notes-error">השמירה נכשלה — נסו שוב.</span>}
      </div>
    </section>
  );
}
