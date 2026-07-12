-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "newListings" INTEGER NOT NULL DEFAULT 0,
    "skippedListings" INTEGER NOT NULL DEFAULT 0,
    "failedScoring" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);
INSERT INTO "new_ScrapeRun" ("errorMessage", "finishedAt", "id", "newListings", "startedAt", "success") SELECT "errorMessage", "finishedAt", "id", "newListings", "startedAt", "success" FROM "ScrapeRun";
DROP TABLE "ScrapeRun";
ALTER TABLE "new_ScrapeRun" RENAME TO "ScrapeRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
