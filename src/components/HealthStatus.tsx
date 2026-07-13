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

  if (status.kind === "error") {
    return (
      <div className="health">
        <span className="health__pill">
          <span className="health__dot" data-state="error" />
          לא ניתן לבדוק את סטטוס הסריקה — ראו יומני שרת.
        </span>
      </div>
    );
  }

  const lastRun = status.lastRun;

  if (!lastRun) {
    return (
      <div className="health">
        <span className="health__pill">
          <span className="health__dot" />
          עדיין לא בוצעה סריקה.
        </span>
      </div>
    );
  }

  const notes = [
    lastRun.skippedListings > 0 ? `${lastRun.skippedListings} דולגו (נתונים חסרים)` : null,
    lastRun.failedScoring > 0 ? `${lastRun.failedScoring} ללא דירוג (שגיאת Claude)` : null,
  ].filter(Boolean);

  return (
    <div className="health">
      <span className="health__pill">
        <span className="health__dot" data-state={lastRun.success ? "ok" : "error"} />
        סריקה אחרונה {new Date(lastRun.startedAt).toLocaleString("he-IL")} —{" "}
        {lastRun.success ? `${lastRun.newListings} מודעות חדשות` : `נכשלה: ${lastRun.errorMessage ?? "שגיאה לא ידועה"}`}
        {notes.length > 0 && ` (${notes.join(", ")})`}
      </span>
    </div>
  );
}
