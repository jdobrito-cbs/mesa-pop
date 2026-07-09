import type { FastifyInstance } from 'fastify'
import statsRoutes from './stats'
import usersRoutes from './users'
import guestsAdminRoutes from './guests'
import onlineAdminRoutes from './online'
import auditRoutes from './audit'
import gamesAdminRoutes from './games'
import roomsAdminRoutes from './rooms'
import rankingsRoutes from './rankings'
import announcementsRoutes from './announcements'
import settingsAdminRoutes from './settings'

/** Todas as rotas /api/admin/* exigem role ADMIN. */
export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAdmin)

  await app.register(statsRoutes)
  await app.register(usersRoutes)
  await app.register(guestsAdminRoutes)
  await app.register(onlineAdminRoutes)
  await app.register(auditRoutes)
  await app.register(gamesAdminRoutes)
  await app.register(roomsAdminRoutes)
  await app.register(rankingsRoutes)
  await app.register(announcementsRoutes)
  await app.register(settingsAdminRoutes)
}
