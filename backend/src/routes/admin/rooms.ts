import type { FastifyInstance } from 'fastify'
import { audit } from '../../lib/audit'

export default async function roomsAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/rooms', async () => {
    const rooms = await app.prisma.room.findMany({
      where: { status: { in: ['WAITING', 'PLAYING'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        game: { select: { slug: true, name: true, icon: true } },
        host: { select: { id: true, displayName: true } },
        _count: { select: { players: { where: { leftAt: null } } } },
      },
    })
    return {
      rooms: rooms.map((r) => ({
        id: r.id,
        code: r.code,
        isPrivate: r.isPrivate,
        status: r.status,
        players: r._count.players,
        maxPlayers: r.maxPlayers,
        createdAt: r.createdAt.toISOString(),
        game: r.game,
        host: r.host,
      })),
    }
  })

  app.post('/api/admin/rooms/:id/close', async (req, reply) => {
    const { id } = req.params as { id: string }
    const room = await app.prisma.room.findUnique({ where: { id } })
    if (!room) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sala não encontrada' })

    await app.prisma.room.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    await audit(app.prisma, 'admin.room.close', {
      userId: req.auth!.sub,
      req,
      detail: { roomId: id, code: room.code },
    })
    return { ok: true }
  })
}
