import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { ListingsMap, type MapListing } from "@/components/ListingsMap";
import { getSessionHouseholdId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const householdId = getSessionHouseholdId();
  if (!householdId) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const all = await db.listing.findMany({
    where: { householdId, status: "active" },
    orderBy: { matchScore: "desc" },
  });

  const located: MapListing[] = all
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({ id: l.id, address: l.address, price: l.price, lat: l.lat!, lng: l.lng!, matchScore: l.matchScore }));
  const unlocated = all.filter((l) => l.lat === null || l.lng === null);

  return (
    <main>
      <h1>מפה</h1>
      <p className="page-subtitle">כל המודעות עם מיקום ידוע על המפה.</p>
      <ListingsMap listings={located} />
      {unlocated.length > 0 && (
        <div className="map-unlocated">
          <h2>ללא מיקום ({unlocated.length})</h2>
          <ul>
            {unlocated.map((l) => (
              <li key={l.id}>
                <Link href={`/listings/${l.id}`}>{l.address}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
