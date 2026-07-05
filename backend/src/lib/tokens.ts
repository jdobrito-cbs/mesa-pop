import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { PrismaClient } from '@prisma/client'
import type { Role } from '@mesapop/shared'
import { config } from '../config'

export interface AccessTokenPayload {
  sub: string
  role: Role
  /** conta convidada ("jogar sem conta"): sem chat, saves ou ranking */
  guest?: boolean
}

export function signAccessToken(userId: string, role: Role, guest = false): string {
  return jwt.sign({ sub: userId, role, guest } satisfies AccessTokenPayload, config.accessSecret, {
    expiresIn: config.accessTtl as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.accessSecret)
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Token inválido')
  }
  const p = payload as jwt.JwtPayload
  return { sub: payload.sub, role: p.role as Role, guest: Boolean(p.guest) }
}

/** Refresh tokens são opacos: aleatórios, guardados apenas como hash SHA-256. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createRefreshToken(prisma: PrismaClient, userId: string) {
  const token = crypto.randomBytes(48).toString('base64url')
  const expiresAt = new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  })
  return { token, expiresAt }
}

/**
 * Valida e rotaciona um refresh token: o antigo é revogado e um novo é
 * emitido. Retorna null se o token for desconhecido, revogado ou expirado.
 */
export async function rotateRefreshToken(prisma: PrismaClient, token: string) {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null
  }
  if (!existing.user.isActive) return null

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  })
  const next = await createRefreshToken(prisma, existing.userId)
  return { user: existing.user, ...next }
}

export async function revokeRefreshToken(prisma: PrismaClient, token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
