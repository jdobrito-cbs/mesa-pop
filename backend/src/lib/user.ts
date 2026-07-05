import type { User } from '@prisma/client'
import type { UserPublic } from '@mesapop/shared'

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }
}
