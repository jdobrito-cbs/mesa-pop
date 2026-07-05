import type { FastifyInstance } from 'fastify'
import type { AdminStats } from '@mesapop/shared'

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
}
