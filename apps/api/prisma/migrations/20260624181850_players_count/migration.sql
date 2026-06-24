/*
  Warnings:

  - You are about to drop the column `coopOfflineMax` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `coopOnlineMax` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "coopOfflineMax",
DROP COLUMN "coopOnlineMax",
ADD COLUMN     "playersMax" INTEGER,
ADD COLUMN     "playersMin" INTEGER;
