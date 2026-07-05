import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { audit } from '../../lib/audit'

const createBody = z.object({
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(1000),
  isActive: z.boolean().default(true),
})

const updateBody = createBody.partial()

export default async function announcementsAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/announcements', async () => {
    const announcements = await app.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return { announcements }
  })

  app.post('/api/admin/announcements', async (req, reply) => {
    const input = createBody.parse(req.body)
    const announcement = await app.prisma.announcement.create({
      data: { ...input, createdBy: req.auth!.sub },
    })
    await audit(app.prisma, 'admin.announcement.create', {
      userId: req.auth!.sub,
      req,
      detail: { id: announcement.id, title: announcement.title },
    })
    return reply.code(201).send({ announcement })
  })

  app.patch('/api/admin/announcements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const input = updateBody.parse(req.body)
    const existing = await app.prisma.announcement.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Aviso não encontrado' })

    const announcement = await app.prisma.announcement.update({ where: { id }, data: input })
    await audit(app.prisma, 'admin.announcement.update', {
      userId: req.auth!.sub,
      req,
      detail: { id, changes: Object.keys(input) },
    })
    return { announcement }
  })

  app.delete('/api/admin/announcements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await app.prisma.announcement.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Aviso não encontrado' })

    await app.prisma.announcement.delete({ where: { id } })
    await audit(app.prisma, 'admin.announcement.delete', {
      userId: req.auth!.sub,
      req,
      detail: { id, title: existing.title },
    })
    return { ok: true }
  })
}
