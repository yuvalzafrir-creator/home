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
      <button onClick={() => onFeedback(id, "like")}>Like</button>
      <button onClick={() => onFeedback(id, "dislike")}>Dislike</button>
    </article>
  );
}
