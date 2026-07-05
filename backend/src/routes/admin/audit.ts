import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const listQuery = z.object({
  email: z.string().trim().optional(),
  action: z.string().trim().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export default async function auditAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/audit', async (req) => {
    const q = listQuery.parse(req.query)
    const where: Prisma.AuditLogWhereInput = {}
    if (q.email) where.user = { email: { contains: q.email, mode: 'insensitive' } }
    if (q.action) where.action = q.action
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      }
    }

    const [total, logs] = await Promise.all([
      app.prisma.auditLog.count({ where }),
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { user: { select: { id: true, email: true, displayName: true } } },
      }),
    ])
    return {
      items: logs.map((l) => ({
        id: l.id,
        action: l.action,
        ip: l.ip,
        userAgent: l.userAgent,
        detail: l.detail,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      })),
      total,
      page: q.page,
      perPage: q.perPage,
    }
  })

  /** Lista de ações distintas para o filtro da UI. */
  app.get('/api/admin/audit/actions', async () => {
    const rows = await app.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    })
    return { actions: rows.map((r) => r.action) }
  })
}
