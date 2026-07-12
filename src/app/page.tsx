"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/types/listing";

export default function FeedPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  async function handleFeedback(listingId: string, reaction: "like" | "dislike") {
    if (pendingIds.has(listingId)) return;
    setPendingIds((prev) => new Set(prev).add(listingId));

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reaction }),
    });

    if (res.ok) {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } else {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }

  return (
    <main>
      <h1>New listings</h1>
      {listings.length === 0 && <p>No listings yet — check back after the next scrape.</p>}
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          {...listing}
          onFeedback={handleFeedback}
          disabled={pendingIds.has(listing.id)}
        />
      ))}
    </main>
  );
}
