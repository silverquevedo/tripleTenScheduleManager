-- CreateTable
CREATE TABLE "AdminEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminEmail_email_key" ON "AdminEmail"("email");
