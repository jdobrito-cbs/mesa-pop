-- CreateTable
CREATE TABLE "PareoBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "lane" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "resultado" TEXT NOT NULL DEFAULT 'pendente',
    "payout" INTEGER NOT NULL DEFAULT 0,
    "liquidaEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PareoBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PareoBet_roomId_numero_userId_key" ON "PareoBet"("roomId", "numero", "userId");

-- CreateIndex
CREATE INDEX "PareoBet_resultado_liquidaEm_idx" ON "PareoBet"("resultado", "liquidaEm");

-- CreateIndex
CREATE INDEX "PareoBet_userId_createdAt_idx" ON "PareoBet"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PareoBet" ADD CONSTRAINT "PareoBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
