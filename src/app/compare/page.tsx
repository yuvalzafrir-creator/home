"use client";

import { useEffect, useState } from "react";
import { CompareTable } from "@/components/CompareTable";
import type { Listing } from "@/types/listing";

export default function ComparePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/listings?filter=favorites")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  const selected = listings.filter((l) => selectedIds.includes(l.id));

  return (
    <main>
      <h1>השוואה</h1>
      <p className="page-subtitle">בחרו 2–4 מועדפים לתצוגה זו לצד זו.</p>
      {listings.length === 0 ? (
        <div className="empty">עדיין אין מועדפים — סמנו כמה מודעות קודם.</div>
      ) : (
        <ul className="compare-picker">
          {listings.map((l) => {
            const atCap = selectedIds.length >= 4 && !selectedIds.includes(l.id);
            return (
              <li key={l.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(l.id)}
                    onChange={() => toggle(l.id)}
                    disabled={atCap}
                  />
                  {l.address}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {selectedIds.length >= 4 && (
        <p className="page-subtitle">נבחרו 4 (מקסימום) — הסירו סימון כדי לבחור אחר.</p>
      )}
      {selected.length >= 2 && <CompareTable listings={selected} />}
    </main>
  );
}
