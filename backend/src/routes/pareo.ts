import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { audit } from '../lib/audit'
import { registrarAposta } from '../lib/pareoApostas'
import type { PareoState } from '../games/pareo'

/**
 * Apostas do Páreo — REST autenticado (o socket segue só com o estado da
 * corrida). O servidor resolve a SALA do apostador pelo RoomManager,
 * valida tudo (fase, páreo, valor, unicidade, saldo) e debita/credita a
 * carteira de fichas da plataforma. Convidado assiste, mas não aposta.
 */

const MENSAGENS: Record<string, { code: number; message: string }> = {
  FASE_ERRADA: { code: 400, message: 'As apostas deste páreo já fecharam — aguarde o próximo!' },
  PAREO_TROCOU: { code: 409, message: 'Esse páreo já passou — aposte no atual' },
  VALOR_INVALIDO: { code: 400, message: 'Valor de aposta inválido' },
  CAVALO_INVALIDO: { code: 400, message: 'Cavalo inválido' },
  JA_APOSTOU: { code: 400, message: 'Você já apostou neste páreo — uma aposta por corrida!' },
  SEM_FICHAS: { code: 400, message: 'Fichas insuficientes para essa aposta' },
}

export default async function pareoRoutes(app: FastifyInstance) {
  /** sala de Páreo ATIVA do usuário (ou null) */
  function salaDe(userId: string) {
    const room = app.rooms.roomOf(userId)
    if (!room || room.gameSlug !== 'pareo' || room.status !== 'PLAYING' || !room.state) return null
    return room
  }

  app.post('/api/pareo/apostar', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para apostar fichas no Páreo' })
    }
    const { numero, lane, valor } = z
      .object({ numero: z.number().int().min(1), lane: z.number().int(), valor: z.number().int() })
      .parse(req.body)
    const userId = req.auth!.sub

    const room = salaDe(userId)
    if (!room) {
      return reply.code(400).send({ error: 'SEM_SALA', message: 'Entre numa sala do Páreo para apostar' })
    }

    const res = await registrarAposta(app.prisma, {
      userId,
      roomId: room.id,
      state: room.state as PareoState,
      numero,
      lane,
      valor,
    })
    if ('erro' in res) {
      const m = MENSAGENS[res.erro]!
      return reply.code(m.code).send({ error: res.erro, message: m.message })
    }
    await audit(app.prisma, 'pareo.aposta', {
      userId,
      req,
      detail: { roomId: room.id, numero, lane, valor, odds: res.odds, saldo: res.fichas },
    })
    return { aposta: { lane: res.lane, valor: res.valor, odds: res.odds }, fichas: res.fichas }
  })

  /** minha aposta no páreo atual + a última liquidada (para a cerimônia) + saldo */
  app.get('/api/pareo/minha', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.auth!.sub
    if (req.auth!.guest) return { fichas: 0, atual: null, ultima: null }
    const room = salaDe(userId)
    if (!room) return reply.code(400).send({ error: 'SEM_SALA', message: 'Você não está numa sala do Páreo' })
    const state = room.state as PareoState

    const [user, atual, ultima] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: userId }, select: { fichas: true } }),
      app.prisma.pareoBet.findUnique({
        where: { roomId_numero_userId: { roomId: room.id, numero: state.numero, userId } },
      }),
      app.prisma.pareoBet.findFirst({
        where: { userId, roomId: room.id, resultado: { not: 'pendente' } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const enxuga = (b: typeof atual) =>
      b ? { numero: b.numero, lane: b.lane, valor: b.valor, odds: b.odds, resultado: b.resultado, payout: b.payout } : null
    return { fichas: user?.fichas ?? 0, atual: enxuga(atual), ultima: enxuga(ultima) }
  })
}
