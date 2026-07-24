-- Clean start for the multi-tenant migration: pre-auth rows have no household
-- to attribute to, so they're cleared before householdId becomes required.
DELETE FROM "Note";
DELETE FROM "Feedback";
DELETE FROM "Listing";
DELETE FROM "PreferenceProfile";
DELETE FROM "Member";

-- DropIndex
DROP INDEX "Listing_sourceUrl_key";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "householdId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "householdId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PreferenceProfile" ADD COLUMN     "householdId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_name_key" ON "Household"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_householdId_sourceUrl_key" ON "Listing"("householdId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceProfile_householdId_key" ON "PreferenceProfile"("householdId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceProfile" ADD CONSTRAINT "PreferenceProfile_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

