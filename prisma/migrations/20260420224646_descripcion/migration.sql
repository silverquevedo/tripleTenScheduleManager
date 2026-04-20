/*
  Warnings:

  - You are about to drop the `ProgramMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProgramMember" DROP CONSTRAINT "ProgramMember_programId_fkey";

-- AlterTable
ALTER TABLE "AdminEmail" ADD COLUMN     "color" TEXT,
ADD COLUMN     "isLeadInstructor" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isManager" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "color" TEXT;

-- DropTable
DROP TABLE "ProgramMember";
