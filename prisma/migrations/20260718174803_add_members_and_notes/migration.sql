-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "memberId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Note_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceSite" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "rooms" REAL NOT NULL,
    "sizeSqm" INTEGER NOT NULL,
    "floor" INTEGER,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasMamad" BOOLEAN NOT NULL DEFAULT false,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "renovated" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "neighborhood" TEXT,
    "lat" REAL,
    "lng" REAL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "addedById" TEXT,
    CONSTRAINT "Listing_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("address", "description", "firstSeenAt", "floor", "hasBalcony", "hasElevator", "hasMamad", "hasParking", "id", "lastSeenAt", "lat", "lng", "matchReason", "matchScore", "neighborhood", "notes", "photoUrl", "price", "renovated", "rooms", "sizeSqm", "sourceSite", "sourceUrl", "status") SELECT "address", "description", "firstSeenAt", "floor", "hasBalcony", "hasElevator", "hasMamad", "hasParking", "id", "lastSeenAt", "lat", "lng", "matchReason", "matchScore", "neighborhood", "notes", "photoUrl", "price", "renovated", "rooms", "sizeSqm", "sourceSite", "sourceUrl", "status" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE UNIQUE INDEX "Listing_sourceUrl_key" ON "Listing"("sourceUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
