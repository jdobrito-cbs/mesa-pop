-- AlterTable
ALTER TABLE "User" ADD COLUMN "fichas" INTEGER NOT NULL DEFAULT 0;

-- admins ATUAIS ganham as 100.000 fichas de boas-vindas (pedido do usuário)
UPDATE "User" SET "fichas" = "fichas" + 100000 WHERE "role" = 'ADMIN';
