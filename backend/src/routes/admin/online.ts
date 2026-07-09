import type { FastifyInstance } from 'fastify'
import type { OnlineOverview, OnlineUser } from '@mesapop/shared'
import type { OnlinePerson } from '../../realtime/presence'

/**
 * Quem está ONLINE agora (socket conectado) e o jogo em que está — separado
 * entre convidados (sem cadastro) e usuários com conta. O jogo vem das salas
 * ao vivo (RoomManager): se a pessoa está numa sala em partida, mostra o jogo.
 */
export default async function onlineAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/online', async (): Promise<OnlineOverview> => {
    const people = app.presence.list()
    const games = await app.prisma.game.findMany({
      select: { slug: true, name: true, icon: true, color: true },
    })
    const bySlug = new Map(games.map((g) => [g.slug, g]))

    const toUser = (p: OnlinePerson): OnlineUser => {
      const room = app.rooms.roomOf(p.userId)
      let game: OnlineUser['game'] = null
      if (room && room.status === 'PLAYING') {
        const g = bySlug.get(room.gameSlug)
        game = {
          slug: room.gameSlug,
          name: g?.name ?? room.gameName,
          icon: g?.icon ?? '🎲',
          color: g?.color ?? '#a855f7',
        }
      }
      return { userId: p.userId, displayName: p.displayName, game }
    }

    return {
      guests: people.filter((p) => p.isGuest).map(toUser),
      users: people.filter((p) => !p.isGuest).map(toUser),
    }
  })
}
