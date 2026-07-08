import crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { loginSchema, registerSchema } from '@mesapop/shared'
import { hashPassword, verifyPassword } from '../lib/password'
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../lib/tokens'
import { audit } from '../lib/audit'
import { toPublicUser } from '../lib/user'
import { getLoginMaxAttempts, LOCK_FOREVER } from '../lib/settings'
import { config, REFRESH_COOKIE } from '../config'

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/api/auth',
    expires: expiresAt,
  })
}

// Limite mais rígido nas rotas de auth (força bruta).
const authRateLimit = {
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', authRateLimit, async (req, reply) => {
    const input = registerSchema.parse(req.body)

    const existing = await app.prisma.user.findUnique({ where: { email: input.email } })
    if (existing) {
      return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado' })
    }
    const usernameTaken = await app.prisma.user.findUnique({ where: { username: input.username } })
    if (usernameTaken) {
      return reply.code(409).send({ error: 'USERNAME_TAKEN', message: 'Este nome de usuário já existe — escolha outro' })
    }

    const user = await app.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        name: input.name,
        displayName: input.username,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
      },
    })
    await audit(app.prisma, 'user.register', { userId: user.id, req })

    const refresh = await createRefreshToken(app.prisma, user.id)
    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return reply.code(201).send({
      user: toPublicUser(user),
      accessToken: signAccessToken(user.id, user.role),
    })
  })

  /**
   * "Jogar sem conta": cria uma conta-sombra de convidado com o NOME
   * informado (obrigatório — é o nome usado nos jogos). Convidados não
   * têm chat, saves nem ranking; para isso, conta de verdade.
   */
  app.post('/api/auth/guest', authRateLimit, async (req, reply) => {
    const { name } = z
      .object({ name: z.string().trim().min(2, 'Diga como quer ser chamado').max(30) })
      .parse(req.body)

    const user = await app.prisma.user.create({
      data: {
        email: `convidado-${crypto.randomUUID()}@guest.mesapop.local`,
        name,
        displayName: name,
        phone: '',
        passwordHash: '!guest', // nunca é um hash argon2 válido → login impossível
        isGuest: true,
      },
    })
    await audit(app.prisma, 'user.guest', { userId: user.id, req })

    const refresh = await createRefreshToken(app.prisma, user.id)
    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return reply.code(201).send({
      user: toPublicUser(user),
      accessToken: signAccessToken(user.id, user.role, true),
    })
  })

  app.post('/api/auth/login', authRateLimit, async (req, reply) => {
    const input = loginSchema.parse(req.body)
    const invalid = () =>
      reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' })

    const user = await app.prisma.user.findUnique({ where: { email: input.email } })
    if (!user || user.isGuest) return invalid()

    // conta bloqueada por tentativas → só o admin libera
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reply.code(403).send({
        error: 'ACCOUNT_LOCKED',
        message: 'Conta bloqueada por tentativas de login. Peça ao administrador para desbloquear.',
      })
    }

    const ok = await verifyPassword(user.passwordHash, input.password)
    if (!ok) {
      const max = await getLoginMaxAttempts(app.prisma)
      const failed = user.failedLogins + 1
      const lock = failed >= max
      await app.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, ...(lock ? { lockedUntil: LOCK_FOREVER } : {}) },
      })
      await audit(app.prisma, lock ? 'auth.login_locked' : 'auth.login_failed', { userId: user.id, req })
      if (lock) {
        return reply.code(403).send({
          error: 'ACCOUNT_LOCKED',
          message: 'Conta bloqueada após várias tentativas. Peça ao administrador para desbloquear.',
        })
      }
      return reply.code(401).send({
        error: 'INVALID_CREDENTIALS',
        message: `E-mail ou senha incorretos (${max - failed} tentativa(s) antes do bloqueio)`,
      })
    }
    if (!user.isActive) {
      return reply.code(403).send({ error: 'ACCOUNT_DISABLED', message: 'Conta desativada' })
    }
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      return reply.code(403).send({
        error: 'ACCOUNT_BANNED',
        message: `Conta suspensa até ${user.bannedUntil.toLocaleDateString('pt-BR')}`,
      })
    }

    // login ok → zera o contador de tentativas
    if (user.failedLogins > 0 || user.lockedUntil) {
      await app.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      })
    }
    await audit(app.prisma, 'auth.login', { userId: user.id, req })
    const refresh = await createRefreshToken(app.prisma, user.id)
    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return {
      user: toPublicUser(user),
      accessToken: signAccessToken(user.id, user.role),
    }
  })

  app.post('/api/auth/refresh', authRateLimit, async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE]
    if (!token) {
      return reply.code(401).send({ error: 'NO_REFRESH', message: 'Sessão expirada' })
    }
    const rotated = await rotateRefreshToken(app.prisma, token)
    if (!rotated) {
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
      return reply.code(401).send({ error: 'INVALID_REFRESH', message: 'Sessão expirada' })
    }
    setRefreshCookie(reply, rotated.token, rotated.expiresAt)
    return {
      user: toPublicUser(rotated.user),
      accessToken: signAccessToken(rotated.user.id, rotated.user.role, rotated.user.isGuest),
    }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE]
    if (token) {
      await revokeRefreshToken(app.prisma, token)
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({ where: { id: req.auth!.sub } })
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Usuário não encontrado' })
    }
    return { user: toPublicUser(user) }
  })
}
