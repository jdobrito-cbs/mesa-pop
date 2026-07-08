import type { FastifyInstance } from 'fastify'
import type { AdminStats, GameActivityRow, GamesActivity } from '@mesapop/shared'

export default async function statsRoutes(app: FastifyInstance) {
  app.get('/api/admin/stats', async (): Promise<AdminStats> => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const since1d = new Date(now - day)
    const since7d = new Date(now - 7 * day)
    const since30d = new Date(now - 30 * day)

    const [
      totalUsers,
      activeUsers,
      newUsers7d,
      dauRows,
      mauRows,
      matchesInProgress,
      matchesTotal,
      roomsOpen,
      gamesEnabled,
      gamesTotal,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.user.count({ where: { isActive: true } }),
      app.prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      app.prisma.auditLog.findMany({
        where: { action: 'auth.login', createdAt: { gte: since1d } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      app.prisma.auditLog.findMany({
        where: { action: 'auth.login', createdAt: { gte: since30d } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      app.prisma.match.count({ where: { status: 'IN_PROGRESS' } }),
      app.prisma.match.count(),
      app.prisma.room.count({ where: { status: { in: ['WAITING', 'PLAYING'] } } }),
      app.prisma.game.count({ where: { isEnabled: true } }),
      app.prisma.game.count(),
    ])

    return {
      totalUsers,
      activeUsers,
      newUsers7d,
      dau: dauRows.length,
      mau: mauRows.length,
      matchesInProgress,
      matchesTotal,
      roomsOpen,
      gamesEnabled,
      gamesTotal,
    }
  })

  /**
   * Atividade de jogos para a Visão geral: o que está sendo jogado AGORA
   * (partidas em andamento por jogo) e o que já foi jogado no sistema
   * (histórico de partidas por jogo).
   */
  app.get('/api/admin/games-activity', async (): Promise<GamesActivity> => {
    const [nowGroups, playedGroups, games] = await Promise.all([
      app.prisma.match.groupBy({
        by: ['gameId'],
        where: { status: 'IN_PROGRESS' },
        _count: { _all: true },
      }),
      app.prisma.match.groupBy({ by: ['gameId'], _count: { _all: true } }),
      app.prisma.game.findMany({
        select: { id: true, slug: true, name: true, icon: true, color: true },
      }),
    ])

    const byId = new Map(games.map((g) => [g.id, g]))
    const toRows = (groups: { gameId: string; _count: { _all: number } }[]): GameActivityRow[] =>
      groups
        .map((row) => {
          const g = byId.get(row.gameId)
          if (!g) return null
          return {
            slug: g.slug,
            name: g.name,
            icon: g.icon,
            color: g.color,
            matches: row._count._all,
          }
        })
        .filter((r): r is GameActivityRow => r !== null)
        .sort((a, b) => b.matches - a.matches)

    const now = toRows(nowGroups)
    const played = toRows(playedGroups)
    return {
      now,
      nowTotal: now.reduce((s, r) => s + r.matches, 0),
      played,
      playedTotal: played.reduce((s, r) => s + r.matches, 0),
    }
  })
}
