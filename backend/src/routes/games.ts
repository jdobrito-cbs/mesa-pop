import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { verifyAccessToken } from '../lib/tokens'

/** identifica o usuário se houver token — sem exigir (lobby é público) */
function optionalUserId(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    return verifyAccessToken(header.slice(7)).sub
  } catch {
    return null
  }
}

/** Rotas públicas do lobby: jogos habilitados, salas abertas e avisos. */
export default async function gamesRoutes(app: FastifyInstance) {
  app.get('/api/games', async () => {
    const games = await app.prisma.game.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })
    return { games }
  })

  /**
   * Destaques da landing (público): os 3 jogos MAIS JOGADOS (por partidas
   * registradas) + 3 ALEATÓRIOS entre os demais — o sorteio muda a cada
   * visita ao site.
   */
  app.get('/api/games/destaque', async () => {
    const games = await app.prisma.game.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })
    const contagens = await app.prisma.match.groupBy({
      by: ['gameId'],
      _count: { _all: true },
    })
    const partidasPor = new Map(contagens.map((c) => [c.gameId, c._count._all]))
    const maisJogados = [...games]
      .sort((a, b) => (partidasPor.get(b.id) ?? 0) - (partidasPor.get(a.id) ?? 0))
      .slice(0, 3)
    const resto = games.filter((g) => !maisJogados.some((m) => m.id === g.id))
    for (let i = resto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[resto[i], resto[j]] = [resto[j]!, resto[i]!]
    }
    const view = (g: (typeof games)[number]) => ({
      slug: g.slug,
      name: g.name,
      description: g.description,
      family: g.family,
      minPlayers: g.minPlayers,
      maxPlayers: g.maxPlayers,
      color: g.color,
      icon: g.icon,
      phase: g.phase,
      enabled: g.isEnabled,
    })
    return { maisJogados: maisJogados.map(view), aleatorios: resto.slice(0, 3).map(view) }
  })

  app.get('/api/rooms', async (req) => {
    const userId = optionalUserId(req)
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
        favorites: userId ? { where: { userId } } : false,
      },
    })
    const rows = rooms.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      maxPlayers: r.maxPlayers,
      players: r.players.length,
      playerNames: r.players.map((p) => p.user.displayName),
      isFavorite: userId ? r.favorites.length > 0 : false,
      createdAt: r.createdAt.toISOString(),
      game: r.game,
      host: r.host,
    }))
    // favoritas fixam no topo
    rows.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
    return { rooms: rows }
  })

  /** favoritar/desfavoritar sala pública (contas registradas) */
  app.post('/api/rooms/:id/favorite', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para favoritar salas' })
    }
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const room = await app.prisma.room.findUnique({ where: { id } })
    if (!room || room.isPrivate) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Só salas públicas podem ser favoritadas' })
    }
    const key = { userId_roomId: { userId: req.auth!.sub, roomId: id } }
    const existing = await app.prisma.favoriteRoom.findUnique({ where: key })
    if (existing) {
      await app.prisma.favoriteRoom.delete({ where: key })
      return { favorite: false }
    }
    await app.prisma.favoriteRoom.create({ data: { userId: req.auth!.sub, roomId: id } })
    return { favorite: true }
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
