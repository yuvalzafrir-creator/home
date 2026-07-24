import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { NoteThread, type ThreadNote } from "@/components/NoteThread";
import { ListingsMap } from "@/components/ListingsMap";
import { getSessionHouseholdId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const householdId = getSessionHouseholdId();
  if (!householdId) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const listing = await db.listing.findFirst({
    where: { id: params.id, householdId },
    include: { addedBy: { select: { name: true } } },
  });
  if (!listing) notFound();

  const noteRows = await db.note.findMany({
    where: { listingId: params.id },
    orderBy: { createdAt: "asc" },
    include: { member: { select: { name: true } } },
  });
  const notes: ThreadNote[] = noteRows.map((n) => ({
    id: n.id,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
    member: n.member ? { name: n.member.name } : null,
  }));

  const amenities = [
    { label: "ממ\"ד", on: listing.hasMamad },
    { label: "מרפסת", on: listing.hasBalcony },
    { label: "חניה", on: listing.hasParking },
    { label: "מעלית", on: listing.hasElevator },
    { label: "משופצת", on: listing.renovated },
  ];

  return (
    <main>
      <Link href="/listings" className="back-link">→ חזרה למודעות</Link>

      <div className="detail-head">
        <div>
          <h1>{listing.address}</h1>
          {listing.neighborhood && <p className="detail-neighborhood">{listing.neighborhood}</p>}
          {listing.addedBy && <p className="detail-addedby">נוסף ע&quot;י {listing.addedBy.name}</p>}
        </div>
        {listing.matchScore !== null && (
          <span className="detail-score">{listing.matchScore}/100 התאמה</span>
        )}
      </div>

      <div className="detail-tiles">
        <div className="dash-tile"><span>מחיר</span><strong>₪{listing.price.toLocaleString()}</strong></div>
        <div className="dash-tile"><span>חדרים</span><strong>{listing.rooms}</strong></div>
        <div className="dash-tile"><span>שטח</span><strong>{listing.sizeSqm} מ&quot;ר</strong></div>
        <div className="dash-tile"><span>קומה</span><strong>{listing.floor ?? "—"}</strong></div>
      </div>

      <div className="amenity-chips">
        {amenities.map((a) => (
          <span key={a.label} className="amenity-chip" data-off={!a.on}>{a.label}</span>
        ))}
      </div>

      {listing.lat !== null && listing.lng !== null && (
        <div style={{ marginBottom: 28 }}>
          <ListingsMap
            height={220}
            listings={[{ id: listing.id, address: listing.address, price: listing.price, lat: listing.lat, lng: listing.lng, matchScore: listing.matchScore }]}
          />
        </div>
      )}

      {listing.matchReason && (
        <section className="detail-section">
          <h2>למה זה מתאים לך</h2>
          <p>{listing.matchReason}</p>
        </section>
      )}

      {listing.description && (
        <section className="detail-section">
          <h2>תיאור</h2>
          <p>{listing.description}</p>
        </section>
      )}

      <NoteThread listingId={listing.id} initial={notes} />

      <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="detail-source">
        למודעה המקורית ↗
      </a>
    </main>
  );
}
