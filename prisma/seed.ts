// Seed a fresh database with a starter preference profile + a few example
// listings so the app isn't empty on first load.
//
// Idempotent + non-destructive: each table is only populated when it's
// currently EMPTY, so running this on every deploy never overwrites or
// duplicates real user data once onboarding has happened.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EXAMPLE_LISTINGS = [
  {
    sourceSite: "yad2",
    sourceUrl: "https://example.com/seed/rothschild-15",
    address: "רוטשילד 15, תל אביב",
    price: 2950000,
    rooms: 4,
    sizeSqm: 96,
    floor: 3,
    hasBalcony: true,
    hasMamad: true,
    lat: 32.0632,
    lng: 34.7712,
    matchScore: 88,
    matchReason: 'ארבעה חדרים באזור מבוקש, עם ממ"ד ומרפסת.',
  },
  {
    sourceSite: "yad2",
    sourceUrl: "https://example.com/seed/sokolov-20",
    address: "סוקולוב 20, רמת גן",
    price: 2450000,
    rooms: 3,
    sizeSqm: 78,
    floor: 2,
    hasParking: true,
    lat: 32.068,
    lng: 34.8248,
    matchScore: 76,
    matchReason: "מרווח עם חניה, מעט מחוץ לאזורים המועדפים.",
  },
  {
    sourceSite: "madlan",
    sourceUrl: "https://example.com/seed/bialik-8",
    address: "ביאליק 8, רמת גן",
    price: 3100000,
    rooms: 3.5,
    sizeSqm: 88,
    hasElevator: true,
    hasMamad: true,
    lat: 32.07,
    lng: 34.814,
    matchScore: 64,
    matchReason: "דירה נחמדה, מעט מעל התקציב ביחס לשטח.",
  },
];

async function main() {
  const profileCount = await db.preferenceProfile.count();
  if (profileCount === 0) {
    await db.preferenceProfile.create({
      data: {
        locations: JSON.stringify(["תל אביב", "רמת גן"]),
        budgetMax: 2800000,
        minRooms: 3,
        mustHaveExtras: JSON.stringify(['ממ"ד']),
        goal: "primary",
        exampleUrls: JSON.stringify([]),
      },
    });
    console.log("seed: created starter preference profile");
  } else {
    console.log("seed: profile already present — skipping");
  }

  const listingCount = await db.listing.count();
  if (listingCount === 0) {
    for (const listing of EXAMPLE_LISTINGS) {
      await db.listing.create({ data: listing });
    }
    console.log(`seed: created ${EXAMPLE_LISTINGS.length} example listings`);
  } else {
    console.log("seed: listings already present — skipping");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
