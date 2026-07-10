import type { User } from '@prisma/client'
import type { UserPublic } from '@mesapop/shared'

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    displayName: user.displayName,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    avatar: user.avatar ?? null,
    isGuest: user.isGuest,
    createdAt: user.createdAt.toISOString(),
  }
}
