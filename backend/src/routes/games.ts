import type { FastifyInstance } from 'fastify'

/** Rotas públicas do lobby: jogos habilitados, salas abertas e avisos. */
export default async function gamesRoutes(app: FastifyInstance) {
  app.get('/api/games', async () => {
    const games = await app.prisma.game.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })
    return { games }
  })

  app.get('/api/rooms', async () => {
    const rooms = await app.prisma.room.findMany({
      where: { status: 'WAITING', isPrivate: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        game: { select: { slug: true, name: true, icon: true, color: true } },
        host: { select: { displayName: true } },
        // quem está SENTADO na sala de espera (para o lobby mostrar as pessoas)
        players: {
          where: { leftAt: null },
          select: { user: { select: { displayName: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })
    return {
      rooms: rooms.map((r) => ({
        id: r.id,
        code: r.code,
        status: r.status,
        maxPlayers: r.maxPlayers,
        players: r.players.length,
        playerNames: r.players.map((p) => p.user.displayName),
        createdAt: r.createdAt.toISOString(),
        game: r.game,
        host: r.host,
      })),
    }
  })

  app.get('/api/announcements', async () => {
    const announcements = await app.prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    return { announcements }
  })
}
