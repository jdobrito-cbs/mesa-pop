import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { GameRankingRow, PlayerRankingRow } from '@mesapop/shared'

const gamesQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

const playersQuery = z.object({
  gameSlug: z.string().trim().optional(),
  metric: z.enum(['wins', 'matches', 'score']).default('wins'),
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default async function rankingsAdminRoutes(app: FastifyInstance) {
  /** Jogos mais jogados no período (contagem de partidas). */
  app.get('/api/admin/rankings/games', async (req) => {
    const q = gamesQuery.parse(req.query)
    const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000)

    const grouped = await app.prisma.match.groupBy({
      by: ['gameId'],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    })
    const games = await app.prisma.game.findMany({
      where: { id: { in: grouped.map((g) => g.gameId) } },
      select: { id: true, slug: true, name: true, icon: true, color: true },
    })
    const byId = new Map(games.map((g) => [g.id, g]))

    const rows: GameRankingRow[] = grouped
      .map((g) => {
        const game = byId.get(g.gameId)
        return game
          ? {
              gameId: g.gameId,
              slug: game.slug,
              name: game.name,
              icon: game.icon,
              color: game.color,
              matches: g._count._all,
            }
          : null
      })
      .filter((r): r is GameRankingRow => r !== null)
      .sort((a, b) => b.matches - a.matches)

    return { rows, days: q.days }
  })

  /** Maiores jogadores — global ou por jogo, por vitórias/partidas/recorde. */
  app.get('/api/admin/rankings/players', async (req) => {
    const q = playersQuery.parse(req.query)
    const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000)

    const game = q.gameSlug
      ? await app.prisma.game.findUnique({ where: { slug: q.gameSlug } })
      : null

    let pairs: Array<{ userId: string; value: number }> = []

    if (q.metric === 'score') {
      const grouped = await app.prisma.score.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: since },
          ...(game ? { gameId: game.id } : {}),
        },
        _max: { points: true },
        orderBy: { _max: { points: 'desc' } },
        take: q.limit,
      })
      pairs = grouped.map((g) => ({ userId: g.userId, value: g._max.points ?? 0 }))
    } else {
      const where: Prisma.MatchPlayerWhereInput = {
        match: {
          startedAt: { gte: since },
          ...(game ? { gameId: game.id } : {}),
        },
        ...(q.metric === 'wins' ? { isWinner: true } : {}),
      }
      const grouped = await app.prisma.matchPlayer.groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: q.limit,
      })
      pairs = grouped.map((g) => ({ userId: g.userId, value: g._count._all }))
    }

    // convidados nunca aparecem em rankings
    const users = await app.prisma.user.findMany({
      where: { id: { in: pairs.map((p) => p.userId) }, isGuest: false },
      select: { id: true, displayName: true, email: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    const rows: PlayerRankingRow[] = pairs
      .map((p) => {
        const u = byId.get(p.userId)
        return u
          ? { userId: p.userId, displayName: u.displayName, email: u.email, value: p.value }
          : null
      })
      .filter((r): r is PlayerRankingRow => r !== null)

    return { rows, metric: q.metric, days: q.days, gameSlug: q.gameSlug ?? null }
  })
}
