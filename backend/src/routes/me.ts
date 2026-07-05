import type { FastifyInstance } from 'fastify'

/**
 * Posição do usuário nos rankings, para a "Minha mesa":
 * - GLOBAL: vitórias em partidas (placement 1), entre contas registradas;
 * - JOGO MAIS JOGADO: posição no ranking desse jogo (melhor pontuação em
 *   jogos solo; vitórias em jogos multiplayer).
 */
export default async function meRoutes(app: FastifyInstance) {
  app.get('/api/me/standing', { preHandler: [app.authenticate] }, async (req) => {
    const userId = req.auth!.sub
    if (req.auth!.guest) return { guest: true }

    // vitórias por usuário (contas registradas)
    const winRows = await app.prisma.matchPlayer.groupBy({
      by: ['userId'],
      where: { placement: 1, user: { isGuest: false } },
      _count: { _all: true },
    })
    const myWins = winRows.find((r) => r.userId === userId)?._count._all ?? 0
    const globalRank = myWins > 0 ? winRows.filter((r) => r._count._all > myWins).length + 1 : null

    // jogo que EU mais joguei
    const myMatches = await app.prisma.matchPlayer.findMany({
      where: { userId },
      select: { match: { select: { gameId: true } } },
    })
    const plays = new Map<string, number>()
    for (const m of myMatches) plays.set(m.match.gameId, (plays.get(m.match.gameId) ?? 0) + 1)
    const [topGameId, topPlays] = [...plays.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

    let topGame: Record<string, unknown> | null = null
    if (topGameId) {
      const game = await app.prisma.game.findUnique({ where: { id: topGameId } })
      if (game) {
        let rank: number | null = null
        let metric = 'vitórias'
        if (game.maxPlayers === 1) {
          // ranking solo: melhor pontuação
          metric = 'pontos'
          const bests = await app.prisma.score.groupBy({
            by: ['userId'],
            where: { gameId: topGameId, user: { isGuest: false } },
            _max: { points: true },
          })
          const mine = bests.find((b) => b.userId === userId)?._max.points ?? null
          if (mine !== null) rank = bests.filter((b) => (b._max.points ?? 0) > mine).length + 1
        } else {
          const wins = await app.prisma.matchPlayer.groupBy({
            by: ['userId'],
            where: { placement: 1, match: { gameId: topGameId }, user: { isGuest: false } },
            _count: { _all: true },
          })
          const mine = wins.find((w) => w.userId === userId)?._count._all ?? 0
          if (mine > 0) rank = wins.filter((w) => w._count._all > mine).length + 1
        }
        topGame = { slug: game.slug, name: game.name, icon: game.icon, plays: topPlays, rank, metric }
      }
    }

    return { guest: false, globalRank, globalWins: myWins, topGame }
  })
}
