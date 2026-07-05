import fp from 'fastify-plugin'
import { Server } from 'socket.io'
import type { Ack } from '@mesapop/shared'
import { verifyAccessToken } from '../lib/tokens'
import { config } from '../config'
import { RoomManager, type RoomUser } from './roomManager'
import { registerGame } from '../games/module'
import { checkersModule } from '../games/checkers'
import { dominoModule } from '../games/domino'
import { oneModule } from '../games/one'
import { esquadraoCoopModule } from '../games/esquadraoCoop'
import { racingModule } from '../games/racing'
import { chessModule } from '../games/chess'
import { desenhaModule } from '../games/desenha'
import { dueloModule } from '../games/duelo'
import { stopModule } from '../games/stop'

declare module 'fastify' {
  interface FastifyInstance {
    io: Server
    rooms: RoomManager
  }
}

registerGame(checkersModule)
registerGame(dominoModule)
registerGame(oneModule)
registerGame(esquadraoCoopModule)
registerGame(racingModule)
registerGame(chessModule)
registerGame(desenhaModule)
registerGame(dueloModule)
registerGame(stopModule)

/** Transforma handlers async em acks {ok, error, data}. */
function withAck<T>(fn: () => Promise<T>) {
  return async (ack: (res: Ack<T>) => void) => {
    try {
      const data = await fn()
      if (typeof ack === 'function') ack({ ok: true, data })
    } catch (err) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: err instanceof Error ? err.message : 'Erro inesperado' })
      }
    }
  }
}

export default fp(async (app) => {
  const io = new Server(app.server, {
    cors: { origin: config.corsOrigin.split(','), credentials: true },
  })
  const rooms = new RoomManager(app.prisma, io)
  app.decorate('io', io)
  app.decorate('rooms', rooms)

  // autenticação do socket: JWT de acesso no handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) return next(new Error('UNAUTHORIZED'))
      const payload = verifyAccessToken(token)
      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user || !user.isActive) return next(new Error('UNAUTHORIZED'))
      socket.data.user = {
        id: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
      } satisfies RoomUser
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as RoomUser

    // reconexão automática: se o usuário já está numa sala viva, retoma
    const existing = rooms.roomOf(user.id)
    if (existing) {
      void rooms.join(user, socket.id, existing.code).catch(() => {})
    }

    socket.on('room:create', (input, ack) => {
      // opções: objeto raso com valores primitivos (ex.: {mode: 'juntos'})
      let options: Record<string, unknown> | null = null
      if (input?.options && typeof input.options === 'object' && !Array.isArray(input.options)) {
        options = {}
        for (const [k, v] of Object.entries(input.options as Record<string, unknown>).slice(0, 8)) {
          if (['string', 'number', 'boolean'].includes(typeof v)) options[k] = v
        }
      }
      void withAck(() =>
        rooms.create(user, socket.id, String(input?.gameSlug ?? ''), Boolean(input?.isPrivate), options),
      )(ack)
    })

    socket.on('room:join', (input, ack) => {
      void withAck(() => rooms.join(user, socket.id, String(input?.code ?? '')))(ack)
    })

    socket.on('room:leave', (ack) => {
      void withAck(async () => {
        await rooms.leave(user.id)
        socket.rooms.forEach((r) => r !== socket.id && socket.leave(r))
      })(ack)
    })

    socket.on('room:start', (ack) => {
      void withAck(() => rooms.start(user.id))(ack)
    })

    socket.on('room:seat', (input, ack) => {
      void withAck(() =>
        rooms.pickSeat(user.id, {
          seat: typeof input?.seat === 'number' ? input.seat : undefined,
          team: input?.team === 0 || input?.team === 1 ? input.team : undefined,
        }),
      )(ack)
    })

    socket.on('game:action', (input, ack) => {
      void withAck(() => rooms.action(user.id, input?.action))(ack)
    })

    socket.on('chat:send', (input, ack) => {
      void withAck(async () => rooms.sendChat(user.id, input?.text))(ack)
    })

    socket.on('disconnect', () => {
      void rooms.onDisconnect(user.id, socket.id)
    })
  })

  app.addHook('onClose', async () => {
    await io.close()
  })
})
