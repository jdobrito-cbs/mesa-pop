import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioc, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import {
  playableSides,
  type Ack,
  type DominoState,
  type DominoView,
  type GameEndView,
  type RoomView,
} from '@mesapop/shared'

/**
 * Integração dos adendos do Dominó: escolha de assento/dupla, espectador
 * sem ver mãos, e rotação (dupla perdedora sai, fila entra). Exige Postgres.
 */

const runId = `rot${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let baseUrl = ''
const sockets: Socket[] = []
const views: (DominoView | null)[] = [null, null, null, null, null]
const seats: number[] = [-9, -9, -9, -9, -9]
let lastRoom: RoomView | null = null
let endEvent: GameEndView | null = null

function connect(token: string, idx: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(baseUrl, { auth: { token }, transports: ['websocket'] })
    s.on('game:state', (p: { state: DominoView; yourSeat: number }) => {
      views[idx] = p.state
      seats[idx] = p.yourSeat
    })
    s.on('room:update', (r: RoomView) => {
      lastRoom = r
    })
    s.on('game:end', (e: GameEndView) => {
      endEvent = e
    })
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}

function emitAck<T>(socket: Socket, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => socket.emit(event, ...args, resolve))
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function registerUser(i: number) {
  const email = `${runId}-p${i}@teste.mesapop.local`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: { email, name: `Jogador ${i}`, phone: '11987654321', password, passwordConfirm: password },
  })
  return res.json().accessToken as string
}

beforeAll(async () => {
  // alvo baixo: a partida (várias mãos até o alvo) termina rápido no teste
  process.env.DOMINO_TARGET = '20'
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  await app.prisma.game.update({ where: { slug: 'domino' }, data: { isEnabled: true } })
  for (let i = 0; i < 5; i++) {
    sockets.push(await connect(await registerUser(i), i))
  }
})

afterAll(async () => {
  sockets.forEach((s) => s.disconnect())
  const testUsers = { email: { startsWith: runId } }
  const matchIds = await app.prisma.matchPlayer.findMany({
    where: { user: testUsers },
    select: { matchId: true },
  })
  await app.prisma.match.deleteMany({ where: { id: { in: matchIds.map((m) => m.matchId) } } })
  await app.prisma.room.deleteMany({ where: { host: testUsers } })
  await app.prisma.user.deleteMany({ where: testUsers })
  await app.close()
})

describe('dominó: assentos, espectador e rotação', () => {
  it('monta a mesa: assento direto, dupla, dupla cheia vai para a outra', async () => {
    const created = await emitAck<RoomView>(sockets[0]!, 'room:create', {
      gameSlug: 'domino',
      isPrivate: false,
    })
    expect(created.ok).toBe(true)
    const code = created.data!.code

    for (let i = 1; i < 4; i++) {
      const joined = await emitAck<RoomView>(sockets[i]!, 'room:join', { code })
      expect(joined.ok).toBe(true)
    }

    // 0 escolhe o assento 0; 1 escolhe a dupla 1 (senta no 1)
    expect((await emitAck(sockets[0]!, 'room:seat', { seat: 0 })).ok).toBe(true)
    expect((await emitAck(sockets[1]!, 'room:seat', { team: 1 })).ok).toBe(true)
    // 2 tenta o assento 0 (ocupado) → erro; então dupla 0 (senta no 2)
    const taken = await emitAck(sockets[2]!, 'room:seat', { seat: 0 })
    expect(taken.ok).toBe(false)
    expect((await emitAck(sockets[2]!, 'room:seat', { team: 0 })).ok).toBe(true)
    // 3 escolhe a dupla 0 — cheia → vai automaticamente para a dupla 1 (assento 3)
    const overflow = await emitAck<RoomView>(sockets[3]!, 'room:seat', { team: 0 })
    expect(overflow.ok).toBe(true)
    const me3 = overflow.data!.players.find((p) => p.displayName === 'Jogador 3')
    expect(me3?.seat).toBe(3)

    // 5º entra: mesa cheia → vira espectador (fila)
    const spect = await emitAck<RoomView>(sockets[4]!, 'room:join', { code })
    expect(spect.ok).toBe(true)
    expect(spect.data!.spectators.map((s) => s.displayName)).toContain('Jogador 4')
    expect(spect.data!.features).toEqual({ seatPicking: true, spectators: true, rotation: true })
  })

  it('a partida roda e o espectador NUNCA vê uma mão', async () => {
    expect((await emitAck(sockets[0]!, 'room:start')).ok).toBe(true)
    await wait(300)

    // espectador recebeu estado com assento -1 e sem mãos
    expect(seats[4]).toBe(-1)
    expect(views[4]!.yourHand).toEqual([])
    expect(views[4]!.handCounts).toEqual([7, 7, 7, 7])
    expect(JSON.stringify(views[4])).not.toContain('"hands"')

    // joga a partida inteira (várias mãos até o alvo) com a lógica compartilhada
    for (let step = 0; step < 500 && !endEvent; step++) {
      const turnIdx = views.findIndex((v, i) => i < 4 && v && seats[i] === v.turn)
      if (turnIdx < 0) {
        await wait(100)
        continue
      }
      const view = views[turnIdx]!
      const pseudo = {
        winnerSeats: view.winnerSeats,
        draw: view.draw,
        awaitingOpener: view.awaitingOpener,
        spinner: view.spinner,
        arms: view.arms,
      } as DominoState
      let played = false
      for (const tile of view.yourHand) {
        const sides = playableSides(pseudo, tile)
        if (sides.length) {
          const res = await emitAck(sockets[turnIdx]!, 'game:action', {
            action: { type: 'play', tile, side: sides[0] },
          })
          expect(res.ok).toBe(true)
          played = true
          break
        }
      }
      if (!played) {
        const res = await emitAck(sockets[turnIdx]!, 'game:action', { action: { type: 'pass' } })
        expect(res.ok).toBe(true)
      }
      await wait(30)
    }

    expect(endEvent).not.toBeNull()
    // vitória de dupla (2 vencedores) ou empate no trancado
    if (!endEvent!.draw) expect(endEvent!.winnerUserIds).toHaveLength(2)
  })

  it('rotação: perdedores saem, o espectador é chamado para a mesa', async () => {
    await wait(400)
    if (endEvent!.draw) return // empate raro: ninguém roda

    expect(lastRoom).not.toBeNull()
    const room = lastRoom!
    expect(room.status).toBe('WAITING')

    // vencedores continuam sentados
    const winners = endEvent!.winnerUserIds
    for (const id of winners) {
      expect(room.players.some((p) => p.userId === id)).toBe(true)
    }
    // o antigo espectador (Jogador 4) foi chamado para a mesa
    expect(room.players.some((p) => p.displayName === 'Jogador 4')).toBe(true)
    // um dos perdedores está na fila agora
    expect(room.spectators.length).toBeGreaterThanOrEqual(1)
  })
})
