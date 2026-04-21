-- AlterTable
ALTER TABLE "ShiftType" ADD COLUMN     "durationLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "durationMin" INTEGER NOT NULL DEFAULT 30;
