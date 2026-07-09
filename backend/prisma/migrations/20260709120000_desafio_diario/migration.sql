-- CreateTable
CREATE TABLE "DesafioPlay" (
    "userId" TEXT NOT NULL,
    "gameSlug" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesafioPlay_pkey" PRIMARY KEY ("userId","gameSlug","date")
);

-- CreateIndex
CREATE INDEX "DesafioPlay_gameSlug_date_done_idx" ON "DesafioPlay"("gameSlug", "date", "done");

-- AddForeignKey
ALTER TABLE "DesafioPlay" ADD CONSTRAINT "DesafioPlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
