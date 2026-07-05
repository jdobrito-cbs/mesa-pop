import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { audit } from '../../lib/audit'

export default async function gamesAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/games', async () => {
    const games = await app.prisma.game.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { matches: true, rooms: true } } },
    })
    return { games }
  })

  app.patch('/api/admin/games/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { isEnabled } = z.object({ isEnabled: z.boolean() }).parse(req.body)

    const game = await app.prisma.game.findUnique({ where: { id } })
    if (!game) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Jogo não encontrado' })

    const updated = await app.prisma.game.update({ where: { id }, data: { isEnabled } })

    // Jogo desabilitado: salas em espera fecham; partidas em andamento
    // podem terminar (decisão registrada no CLAUDE.md).
    if (!isEnabled) {
      await app.prisma.room.updateMany({
        where: { gameId: id, status: 'WAITING' },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
    }

    await audit(app.prisma, 'admin.game.toggle', {
      userId: req.auth!.sub,
      req,
      detail: { gameId: id, slug: game.slug, isEnabled },
    })
    return { game: updated }
  })
}
