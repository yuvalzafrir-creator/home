-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PreferenceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PreferenceProfile" ("budgetMax", "createdAt", "exampleUrls", "freeText", "goal", "id", "learnedSummary", "locations", "minRooms", "minSizeSqm", "mustHaveExtras", "openToFixerUpper", "openToRenting", "renovationBudget", "updatedAt") SELECT "budgetMax", "createdAt", "exampleUrls", "freeText", "goal", "id", "learnedSummary", "locations", "minRooms", "minSizeSqm", "mustHaveExtras", "openToFixerUpper", "openToRenting", "renovationBudget", "updatedAt" FROM "PreferenceProfile";
DROP TABLE "PreferenceProfile";
ALTER TABLE "new_PreferenceProfile" RENAME TO "PreferenceProfile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
