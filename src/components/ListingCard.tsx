"use client";

import Link from "next/link";

interface ListingCardProps {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
  sourceUrl: string;
  onFeedback: (id: string, reaction: "like" | "dislike") => void;
  disabled: boolean;
}

export function ListingCard({
  id,
  address,
  price,
  rooms,
  sizeSqm,
  matchScore,
  matchReason,
  sourceUrl,
  onFeedback,
  disabled,
}: ListingCardProps) {
  return (
    <article className="listing">
      <h3><Link href={`/listings/${id}`} className="listing__title">{address}</Link></h3>
      <p className="listing__meta">
        ₪{price.toLocaleString()} · {rooms} חד&apos; · {sizeSqm} מ&quot;ר
      </p>
      {matchScore !== null && (
        <p className="listing__match">
          <span className="listing__score">
            {matchScore}
            <small>/100</small>
          </span>
          {matchReason}
        </p>
      )}
      <div className="listing__actions">
        <button className="btn-like" onClick={() => onFeedback(id, "like")} disabled={disabled}>
          שמור
        </button>
        <button className="btn-dislike" onClick={() => onFeedback(id, "dislike")} disabled={disabled}>
          לא מתאים
        </button>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="listing__source"
          onClick={(e) => e.stopPropagation()}
        >
          למודעה המקורית ↗
        </a>
      </div>
    </article>
  );
}
