-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_defaultProgramId_idx" ON "User"("defaultProgramId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_programId_idx" ON "Shift"("programId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_programId_memberName_idx" ON "Shift"("programId", "memberName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_memberName_idx" ON "Shift"("memberName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_taskCode_idx" ON "Shift"("taskCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminEmail_defaultProgramId_idx" ON "AdminEmail"("defaultProgramId");
