/*
  Warnings:

  - Added the required column `householdId` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `householdId` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `householdId` to the `PreferenceProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
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
    CONSTRAINT "Listing_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("addedById", "address", "description", "firstSeenAt", "floor", "hasBalcony", "hasElevator", "hasMamad", "hasParking", "id", "lastSeenAt", "lat", "lng", "matchReason", "matchScore", "neighborhood", "notes", "photoUrl", "price", "renovated", "rooms", "sizeSqm", "sourceSite", "sourceUrl", "status") SELECT "addedById", "address", "description", "firstSeenAt", "floor", "hasBalcony", "hasElevator", "hasMamad", "hasParking", "id", "lastSeenAt", "lat", "lng", "matchReason", "matchScore", "neighborhood", "notes", "photoUrl", "price", "renovated", "rooms", "sizeSqm", "sourceSite", "sourceUrl", "status" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE UNIQUE INDEX "Listing_householdId_sourceUrl_key" ON "Listing"("householdId", "sourceUrl");
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE TABLE "new_PreferenceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "minRooms" REAL,
    "minSizeSqm" INTEGER,
    "mustHaveExtras" TEXT NOT NULL,
    "settlementTypes" TEXT NOT NULL DEFAULT '[]',
    "goal" TEXT NOT NULL,
    "openToRenting" BOOLEAN NOT NULL DEFAULT false,
    "openToFixerUpper" BOOLEAN NOT NULL DEFAULT false,
    "renovationBudget" INTEGER,
    "freeText" TEXT,
    "exampleUrls" TEXT NOT NULL,
    "learnedSummary" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PreferenceProfile_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PreferenceProfile" ("budgetMax", "createdAt", "exampleUrls", "freeText", "goal", "id", "learnedSummary", "locations", "minRooms", "minSizeSqm", "mustHaveExtras", "openToFixerUpper", "openToRenting", "renovationBudget", "settlementTypes", "updatedAt") SELECT "budgetMax", "createdAt", "exampleUrls", "freeText", "goal", "id", "learnedSummary", "locations", "minRooms", "minSizeSqm", "mustHaveExtras", "openToFixerUpper", "openToRenting", "renovationBudget", "settlementTypes", "updatedAt" FROM "PreferenceProfile";
DROP TABLE "PreferenceProfile";
ALTER TABLE "new_PreferenceProfile" RENAME TO "PreferenceProfile";
CREATE UNIQUE INDEX "PreferenceProfile_householdId_key" ON "PreferenceProfile"("householdId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Household_name_key" ON "Household"("name");
