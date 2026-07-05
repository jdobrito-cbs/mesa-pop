-- Palavra do Dia: uma partida por usuário por dia
CREATE TABLE "TermoPlay" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "attempts" JSONB NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoPlay_pkey" PRIMARY KEY ("userId","date")
);

CREATE INDEX "TermoPlay_date_won_idx" ON "TermoPlay"("date", "won");

ALTER TABLE "TermoPlay" ADD CONSTRAINT "TermoPlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
