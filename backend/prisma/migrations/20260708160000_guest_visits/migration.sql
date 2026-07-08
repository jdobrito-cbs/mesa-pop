-- registro permanente das visitas de convidados (relatório mensal)
CREATE TABLE "GuestVisit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestVisit_createdAt_idx" ON "GuestVisit"("createdAt");
