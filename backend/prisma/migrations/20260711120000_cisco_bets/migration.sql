-- CreateTable
CREATE TABLE "CiscoBet" (
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

    CONSTRAINT "CiscoBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CiscoBet_roomId_numero_userId_key" ON "CiscoBet"("roomId", "numero", "userId");

-- CreateIndex
CREATE INDEX "CiscoBet_resultado_liquidaEm_idx" ON "CiscoBet"("resultado", "liquidaEm");

-- CreateIndex
CREATE INDEX "CiscoBet_userId_createdAt_idx" ON "CiscoBet"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CiscoBet" ADD CONSTRAINT "CiscoBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
