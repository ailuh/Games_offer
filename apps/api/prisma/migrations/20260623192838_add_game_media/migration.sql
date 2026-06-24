-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "headerImage" TEXT,
ADD COLUMN     "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[];
