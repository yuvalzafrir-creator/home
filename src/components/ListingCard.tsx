"use client";

interface ListingCardProps {
  id: string;
  address: string;
  price: number;
  rooms: number;
  sizeSqm: number;
  matchScore: number | null;
  matchReason: string | null;
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
  onFeedback,
  disabled,
}: ListingCardProps) {
  return (
    <article className="listing">
      <h3>{address}</h3>
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
      </div>
    </article>
  );
}
