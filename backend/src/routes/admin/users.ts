import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma, User } from '@prisma/client'
import { emailSchema, nameSchema, passwordSchema, phoneSchema } from '@mesapop/shared'
import type { UserAdminView } from '@mesapop/shared'
import { hashPassword } from '../../lib/password'
import { audit } from '../../lib/audit'

function toAdminView(u: User): UserAdminView {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    isGuest: u.isGuest,
    name: u.name,
    displayName: u.displayName,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    isActive: u.isActive,
    bannedUntil: u.bannedUntil?.toISOString() ?? null,
    banReason: u.banReason,
    locked: !!u.lockedUntil && u.lockedUntil > new Date(),
    failedLogins: u.failedLogins,
  }
}

const listQuery = z.object({
  search: z.string().trim().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

const createBody = z.object({
  email: emailSchema,
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  role: z.enum(['USER', 'ADMIN']).default('USER'),
})

const updateBody = z.object({
  name: nameSchema.optional(),
  displayName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
  // banimento: data futura (temporário), null limpa; banReason acompanha
  bannedUntil: z.string().datetime().nullable().optional(),
  banReason: z.string().trim().max(300).nullable().optional(),
})

export default async function usersAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/users', async (req) => {
    const q = listQuery.parse(req.query)
    const where: Prisma.UserWhereInput = {}
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
        { displayName: { contains: q.search, mode: 'insensitive' } },
      ]
    }
    if (q.role) where.role = q.role
    if (q.status === 'active') where.isActive = true
    if (q.status === 'inactive') where.isActive = false
    if (q.status === 'banned') where.bannedUntil = { gt: new Date() }

    const [total, users] = await Promise.all([
      app.prisma.user.count({ where }),
      app.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    return { items: users.map(toAdminView), total, page: q.page, perPage: q.perPage }
  })

  app.get('/api/admin/users/export.csv', async (req, reply) => {
    const users = await app.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`
    const rows = [
      'id,email,nome,telefone,role,ativo,banido_ate,criado_em',
      ...users.map((u) =>
        [
          u.id,
          esc(u.email),
          esc(u.name),
          esc(u.phone),
          u.role,
          u.isActive,
          u.bannedUntil?.toISOString() ?? '',
          u.createdAt.toISOString(),
        ].join(','),
      ),
    ]
    await audit(app.prisma, 'admin.users.export', { userId: req.auth!.sub, req })
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="mesapop-usuarios.csv"')
      .send(rows.join('\n'))
  })

  app.get('/api/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await app.prisma.user.findUnique({ where: { id } })
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    const [matches, wins, scores] = await Promise.all([
      app.prisma.matchPlayer.count({ where: { userId: id } }),
      app.prisma.matchPlayer.count({ where: { userId: id, isWinner: true } }),
      app.prisma.score.count({ where: { userId: id } }),
    ])
    return { user: toAdminView(user), stats: { matches, wins, scores } }
  })

  app.post('/api/admin/users', async (req, reply) => {
    const input = createBody.parse(req.body)
    const existing = await app.prisma.user.findUnique({ where: { email: input.email } })
    if (existing) {
      return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado' })
    }
    const user = await app.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        displayName: input.name,
        phone: input.phone,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
    })
    await audit(app.prisma, 'admin.user.create', {
      userId: req.auth!.sub,
      req,
      detail: { targetUserId: user.id, email: user.email, role: user.role },
    })
    return reply.code(201).send({ user: toAdminView(user) })
  })

  app.patch('/api/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const input = updateBody.parse(req.body)

    if (id === req.auth!.sub && (input.role === 'USER' || input.isActive === false)) {
      return reply.code(400).send({
        error: 'SELF_LOCKOUT',
        message: 'Você não pode remover seu próprio acesso de admin',
      })
    }

    const target = await app.prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })

    const data: Prisma.UserUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.displayName !== undefined) data.displayName = input.displayName
    if (input.phone !== undefined) data.phone = input.phone
    if (input.role !== undefined) data.role = input.role
    if (input.isActive !== undefined) data.isActive = input.isActive
    if (input.password !== undefined) data.passwordHash = await hashPassword(input.password)
    if (input.bannedUntil !== undefined) {
      data.bannedUntil = input.bannedUntil ? new Date(input.bannedUntil) : null
    }
    if (input.banReason !== undefined) data.banReason = input.banReason

    const user = await app.prisma.user.update({ where: { id }, data })

    // Conta desativada ou banida perde todas as sessões imediatamente.
    const lostAccess =
      input.isActive === false || (input.bannedUntil && new Date(input.bannedUntil) > new Date())
    if (lostAccess) {
      await app.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }

    await audit(app.prisma, 'admin.user.update', {
      userId: req.auth!.sub,
      req,
      detail: { targetUserId: id, changes: Object.keys(input) },
    })
    return { user: toAdminView(user) }
  })

  // desbloqueia uma conta travada por tentativas de login
  app.post('/api/admin/users/:id/unlock', async (req, reply) => {
    const { id } = req.params as { id: string }
    const target = await app.prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    const user = await app.prisma.user.update({
      where: { id },
      data: { failedLogins: 0, lockedUntil: null },
    })
    await audit(app.prisma, 'admin.user.unlock', {
      userId: req.auth!.sub,
      req,
      detail: { targetUserId: id, email: target.email },
    })
    return { user: toAdminView(user) }
  })

  app.delete('/api/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (id === req.auth!.sub) {
      return reply.code(400).send({ error: 'SELF_DELETE', message: 'Você não pode excluir a si mesmo' })
    }
    const target = await app.prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    try {
      await app.prisma.user.delete({ where: { id } })
    } catch {
      return reply.code(409).send({
        error: 'HAS_HISTORY',
        message: 'Usuário tem histórico vinculado (salas criadas). Desative a conta em vez de excluir.',
      })
    }
    await audit(app.prisma, 'admin.user.delete', {
      userId: req.auth!.sub,
      req,
      detail: { targetUserId: id, email: target.email },
    })
    return { ok: true }
  })
}
