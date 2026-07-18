"use client";

import { useEffect, useState } from "react";
import { CRIME_YEAR, type LocalityInsight } from "@/lib/insights";

function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("he-IL");
}

export function LocationInsights() {
  const [insights, setInsights] = useState<LocalityInsight[] | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((res) => res.json())
      .then((data) => setInsights(data.insights ?? []))
      .catch(() => setInsights([]));
  }, []);

  if (insights === null) {
    return (
      <div className="skeleton-list">
        <div className="skeleton-card" style={{ height: 120 }} />
      </div>
    );
  }
  if (insights.length === 0) return null;

  return (
    <>
      <div className="insights-grid">
        {insights.map((it) => (
          <div className="insight-card" key={it.query}>
            <div className="insight-card__name">{it.name ?? it.query}</div>
            {it.name === null ? (
              <p className="insight-card__empty">לא נמצאו נתונים ליישוב זה.</p>
            ) : (
              <dl className="insight-stats">
                <div>
                  <dt>אוכלוסייה</dt>
                  <dd>{fmt(it.population)}</dd>
                </div>
                <div>
                  <dt>משקי בית</dt>
                  <dd>{fmt(it.households)}</dd>
                </div>
                <div>
                  <dt>נפשות למשק בית</dt>
                  <dd>{it.avgHouseholdSize ?? "—"}</dd>
                </div>
                {it.socioeconomicCluster !== null && (
                  <div>
                    <dt>אשכול חברתי-כלכלי</dt>
                    <dd>{it.socioeconomicCluster}/10</dd>
                  </div>
                )}
                {it.recordedOffenses !== null && (
                  <div>
                    <dt>עבירות ל-1,000 תושבים ({CRIME_YEAR})</dt>
                    <dd>
                      {it.population
                        ? (Math.round((it.recordedOffenses / it.population) * 1000 * 10) / 10).toLocaleString("he-IL")
                        : it.recordedOffenses.toLocaleString("he-IL")}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <p className="insight-card__soon">מחיר למ&quot;ר ועסקאות אחרונות — בקרוב</p>
          </div>
        ))}
      </div>
      <p className="insights-source">מקור: הלשכה המרכזית לסטטיסטיקה · data.gov.il</p>
    </>
  );
}
