-- AlterTable
ALTER TABLE "App" ADD COLUMN     "keyVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT;
