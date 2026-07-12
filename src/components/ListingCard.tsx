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
    <article>
      <h3>{address}</h3>
      <p>₪{price.toLocaleString()} · {rooms} rooms · {sizeSqm}m²</p>
      {matchScore !== null && (
        <p>
          Match: {matchScore}/100 — {matchReason}
        </p>
      )}
      <button onClick={() => onFeedback(id, "like")} disabled={disabled}>Like</button>
      <button onClick={() => onFeedback(id, "dislike")} disabled={disabled}>Dislike</button>
    </article>
  );
}
