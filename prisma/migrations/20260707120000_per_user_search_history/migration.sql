-- CreateTable
CREATE TABLE "UserSearch" (
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSearch_pkey" PRIMARY KEY ("userId","locationId")
);

-- CreateIndex
CREATE INDEX "UserSearch_userId_lastSearchedAt_idx" ON "UserSearch"("userId", "lastSearchedAt");

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearch" ADD CONSTRAINT "UserSearch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SearchLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
