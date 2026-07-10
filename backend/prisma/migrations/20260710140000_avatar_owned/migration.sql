-- CreateTable
CREATE TABLE "AvatarOwned" (
    "userId" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarOwned_pkey" PRIMARY KEY ("userId","avatarId")
);

-- AddForeignKey
ALTER TABLE "AvatarOwned" ADD CONSTRAINT "AvatarOwned_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
