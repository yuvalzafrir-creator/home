"use client";

import { useEffect, useState } from "react";

interface ScrapeRun {
  startedAt: string;
  success: boolean;
  newListings: number;
  skippedListings: number;
  failedScoring: number;
  errorMessage: string | null;
}

export function HealthStatus() {
  const [lastRun, setLastRun] = useState<ScrapeRun | null>(null);

  useEffect(() => {
    fetch("/api/scrape-runs")
      .then((res) => res.json())
      .then((data) => setLastRun(data.lastRun));
  }, []);

  if (!lastRun) return <p>No scrape has run yet.</p>;

  const notes = [
    lastRun.skippedListings > 0 ? `${lastRun.skippedListings} skipped (bad data)` : null,
    lastRun.failedScoring > 0 ? `${lastRun.failedScoring} unscored (Claude error)` : null,
  ].filter(Boolean);

  return (
    <p>
      Last scrape: {new Date(lastRun.startedAt).toLocaleString()} —{" "}
      {lastRun.success ? `${lastRun.newListings} new listings` : `failed: ${lastRun.errorMessage}`}
      {notes.length > 0 && ` (${notes.join(", ")})`}
    </p>
  );
}
