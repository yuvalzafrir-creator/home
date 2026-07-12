"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/components/ListingCard";

interface Listing {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
}

export default function FeedPage() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  async function handleFeedback(listingId: string, reaction: "like" | "dislike") {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reaction }),
    });
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  return (
    <main>
      <h1>New listings</h1>
      {listings.length === 0 && <p>No listings yet — check back after the next scrape.</p>}
      {listings.map((listing) => (
        <ListingCard key={listing.id} {...listing} onFeedback={handleFeedback} />
      ))}
    </main>
  );
}
