-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "coopLocal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coopOfflineMax" INTEGER,
ADD COLUMN     "coopOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coopOnlineMax" INTEGER,
ADD COLUMN     "coopSplitscreen" BOOLEAN NOT NULL DEFAULT false;
