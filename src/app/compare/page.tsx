"use client";

import { useEffect, useState } from "react";
import { CompareTable } from "@/components/CompareTable";

interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
}

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
      <h1>Compare</h1>
      <p>Select 2-4 favorites to compare:</p>
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedIds.includes(l.id)}
                onChange={() => toggle(l.id)}
              />
              {l.address}
            </label>
          </li>
        ))}
      </ul>
      {selected.length >= 2 && <CompareTable listings={selected} />}
    </main>
  );
}
