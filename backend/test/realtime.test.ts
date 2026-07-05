import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioc, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import {
  legalMoves,
  type Ack,
  type ChatMessageView,
  type CheckersState,
  type RoomView,
} from '@mesapop/shared'

/**
 * Integração do tempo real: dois clientes criam sala, jogam Damas e
 * terminam com W.O. no abandono. Exige Postgres.
 */

const runId = `rt${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let baseUrl = ''
let tokenA = ''
let tokenB = ''
let sockA: Socket
let sockB: Socket

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(baseUrl, { auth: { token }, transports: ['websocket'] })
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}

function emitAck<T>(socket: Socket, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => socket.emit(event, ...args, resolve))
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve))
}

async function registerUser(suffix: string) {
  const email = `${runId}-${suffix}@teste.mesapop.local`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: { email, name: `Player ${suffix}`, phone: '11987654321', password, passwordConfirm: password },
  })
  return res.json().accessToken as string
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`

  await app.prisma.game.update({ where: { slug: 'damas' }, data: { isEnabled: true } })
  tokenA = await registerUser('a')
  tokenB = await registerUser('b')
  sockA = await connect(tokenA)
  sockB = await connect(tokenB)
})

afterAll(async () => {
  sockA?.disconnect()
  sockB?.disconnect()
  // ordem importa: partidas e salas dos usuários de teste saem antes deles
  const testUsers = { email: { endsWith: '@teste.mesapop.local' } }
  const matchIds = await app.prisma.matchPlayer.findMany({
    where: { user: testUsers },
    select: { matchId: true },
  })
  await app.prisma.match.deleteMany({
    where: { id: { in: matchIds.map((m) => m.matchId) } },
  })
  await app.prisma.room.deleteMany({ where: { host: testUsers } })
  await app.prisma.user.deleteMany({ where: testUsers })
  await app.close()
})

describe('salas + damas em tempo real', () => {
  it('recusa socket sem token', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const s = ioc(baseUrl, { transports: ['websocket'] })
        s.on('connect', () => resolve('conectou'))
        s.on('connect_error', (e) => {
          s.close()
          reject(e)
        })
      }),
    ).rejects.toThrow('UNAUTHORIZED')
  })

  it('cria sala privada, o amigo entra pelo código e a partida roda', async () => {
    const created = await emitAck<RoomView>(sockA, 'room:create', {
      gameSlug: 'damas',
      isPrivate: true,
    })
    expect(created.ok).toBe(true)
    const code = created.data!.code
    expect(code).toHaveLength(6)

    const joined = await emitAck<RoomView>(sockB, 'room:join', { code })
    expect(joined.ok).toBe(true)
    expect(joined.data!.players).toHaveLength(2)

    // só o anfitrião começa
    const notHost = await emitAck(sockB, 'room:start')
    expect(notHost.ok).toBe(false)

    const stateA = once<{ state: CheckersState; yourSeat: number }>(sockA, 'game:state')
    const stateB = once<{ state: CheckersState; yourSeat: number }>(sockB, 'game:state')
    const started = await emitAck(sockA, 'room:start')
    expect(started.ok).toBe(true)

    const [a, b] = await Promise.all([stateA, stateB])
    expect(new Set([a.yourSeat, b.yourSeat])).toEqual(new Set([0, 1]))
    expect(a.state.turn).toBe(0)

    // quem tem o seat 0 joga um lance legal; o outro tenta e é barrado
    const first = a.yourSeat === 0 ? sockA : sockB
    const second = a.yourSeat === 0 ? sockB : sockA
    const firstState = a.yourSeat === 0 ? a.state : b.state

    const wrongTurn = await emitAck(second, 'game:action', {
      action: { from: 0, to: 9 },
    })
    expect(wrongTurn.ok).toBe(false)
    expect(wrongTurn.error).toBe('Não é a sua vez')

    const move = legalMoves(firstState)[0]!
    const nextForSecond = once<{ state: CheckersState }>(second, 'game:state')
    const played = await emitAck(first, 'game:action', {
      action: { from: move.from, to: move.to },
    })
    expect(played.ok).toBe(true)

    const after = await nextForSecond
    expect(after.state.turn).toBe(1)
    expect(after.state.board[move.to]).not.toBeNull()

    // lance ilegal é recusado
    const illegal = await emitAck(second, 'game:action', { action: { from: 0, to: 63 } })
    expect(illegal.ok).toBe(false)
  })

  it('chat da sala: mensagem chega ao parceiro, com anti-flood e limites', async () => {
    const received = once<ChatMessageView>(sockB, 'chat:message')
    const sent = await emitAck(sockA, 'chat:send', { text: '  boa sorte!  ' })
    expect(sent.ok).toBe(true)

    const msg = await received
    expect(msg.text).toBe('boa sorte!') // sanitizada (trim + espaços)
    expect(msg.displayName).toBe('Player a')

    // flood imediato é barrado
    const flood = await emitAck(sockA, 'chat:send', { text: 'spam' })
    expect(flood.ok).toBe(false)

    // mensagem vazia e gigante são barradas
    const empty = await emitAck(sockB, 'chat:send', { text: '   ' })
    expect(empty.ok).toBe(false)
    const huge = await emitAck(sockB, 'chat:send', { text: 'x'.repeat(301) })
    expect(huge.ok).toBe(false)
  })

  it('abandono no meio da partida dá W.O. ao adversário', async () => {
    const end = Promise.race([
      once<{ winnerUserId: string | null; reason: string }>(sockA, 'game:end'),
      once<{ winnerUserId: string | null; reason: string }>(sockB, 'game:end'),
    ])
    const left = await emitAck(sockB, 'room:leave')
    expect(left.ok).toBe(true)

    const result = await end
    expect(result.reason).toBe('wo')
    expect(result.winnerUserId).toBeTruthy()

    // a vitória por W.O. conta no banco (ranking usa MatchPlayer)
    const winners = await app.prisma.matchPlayer.count({
      where: { isWinner: true, user: { email: { startsWith: runId } } },
    })
    expect(winners).toBe(1)
  })
})
