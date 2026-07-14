"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/types/listing";

type FilterOption = "all" | "favorites" | "unseen";

export function ListingsClient() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const query = filter === "all" ? "" : `?filter=${filter}`;
    fetch(`/api/listings${query}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, [filter]);

  async function handleFeedback(listingId: string, reaction: "like" | "dislike") {
    if (pendingIds.has(listingId)) return;
    setPendingIds((prev) => new Set(prev).add(listingId));

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reaction }),
    });

    if (!res.ok) {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
      return;
    }

    // Re-fetch so the current filter reflects the new reaction (e.g. a like should
    // appear immediately under "favorites"; unlike Task 13's feed, we don't remove
    // the listing from view here since this page is a history/browsing view, not
    // a triage queue.
    const query = filter === "all" ? "" : `?filter=${filter}`;
    const refreshed = await fetch(`/api/listings${query}`);
    const data = await refreshed.json();
    setListings(data.listings);

    // Only clear the pending guard once the whole success path (including the
    // refetch) has completed, so a fast second click during the refetch window
    // can't slip past the guard and create a duplicate Feedback row.
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
  }

  return (
    <main>
      <h1>מודעות</h1>
      <p className="page-subtitle">כל מה שנמצא עד כה — סננו כדי להתמקד.</p>
      <div className="control-row">
        <label htmlFor="filter">סינון</label>
        <select
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
        >
          <option value="all">הכל</option>
          <option value="favorites">מועדפים</option>
          <option value="unseen">טרם נצפו</option>
        </select>
      </div>
      {listings.length === 0 ? (
        <div className="empty">אין מודעות שתואמות לסינון עדיין.</div>
      ) : (
        <div className="card-list">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              {...listing}
              onFeedback={handleFeedback}
              disabled={pendingIds.has(listing.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
