// One-off: geocode existing listings that have no coordinates yet.
// Run: npx tsx src/scraper/geocode-backfill.ts
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";

async function main() {
  const listings = await db.listing.findMany({ where: { OR: [{ lat: null }, { lng: null }] } });
  console.log(`Geocoding ${listings.length} listing(s)…`);
  for (const l of listings) {
    const geo = await geocodeAddress(l.address);
    if (geo) {
      await db.listing.update({ where: { id: l.id }, data: { lat: geo.lat, lng: geo.lng } });
      console.log(`  ✓ ${l.address} → ${geo.lat},${geo.lng}`);
    } else {
      console.warn(`  ✗ ${l.address} — no result`);
    }
    // Respect Nominatim's ~1 req/sec usage policy.
    await new Promise((r) => setTimeout(r, 1100));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
