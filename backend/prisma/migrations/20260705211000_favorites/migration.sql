-- salas públicas favoritadas (fixam no topo do lobby do usuário)
CREATE TABLE "FavoriteRoom" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRoom_pkey" PRIMARY KEY ("userId","roomId")
);

ALTER TABLE "FavoriteRoom" ADD CONSTRAINT "FavoriteRoom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteRoom" ADD CONSTRAINT "FavoriteRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
