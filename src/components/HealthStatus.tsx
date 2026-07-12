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

type Status = { kind: "loading" } | { kind: "error" } | { kind: "loaded"; lastRun: ScrapeRun | null };

export function HealthStatus() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/scrape-runs")
      .then((res) => {
        if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
        return res.json();
      })
      .then((data) => setStatus({ kind: "loaded", lastRun: data.lastRun }))
      .catch(() => setStatus({ kind: "error" }));
  }, []);

  if (status.kind === "loading") return null;
  if (status.kind === "error") return <p>Couldn't check scrape status — see server logs.</p>;

  const lastRun = status.lastRun;
  if (!lastRun) return <p>No scrape has run yet.</p>;

  const notes = [
    lastRun.skippedListings > 0 ? `${lastRun.skippedListings} skipped (bad data)` : null,
    lastRun.failedScoring > 0 ? `${lastRun.failedScoring} unscored (Claude error)` : null,
  ].filter(Boolean);

  return (
    <p>
      Last scrape: {new Date(lastRun.startedAt).toLocaleString()} —{" "}
      {lastRun.success ? `${lastRun.newListings} new listings` : `failed: ${lastRun.errorMessage ?? "unknown error"}`}
      {notes.length > 0 && ` (${notes.join(", ")})`}
    </p>
  );
}
