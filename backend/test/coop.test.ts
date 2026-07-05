import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioc, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import type { Ack, CoopSnapshot, RoomView } from '@mesapop/shared'
import {
  applyCoopAction,
  initialCoopState,
  tickCoop,
  type CoopState,
} from '../src/games/esquadraoCoop'

/* ------------------- unidade: simulação ------------------- */

function cleanState(mode: 'juntos' | 'lado-a-lado'): CoopState {
  const s = initialCoopState(mode)
  // sem spawns interferindo nos testes de regra
  s.airTimer = 9999
  s.carTimer = 9999
  s.tankTimer = 9999
  s.powerupTimer = 9999
  s.bossTimer = 9999
  return s
}

describe('co-op: simulação', () => {
  it('modo juntos: hit derruba; parceiro perto reanima em ~2s', () => {
    const s = cleanState('juntos')
    const [a, b] = s.planes
    // bala inimiga em cima do avião A
    s.enemyBullets.push({ x: a!.x, y: a!.y, vx: 0, vy: 0, r: 4, color: '#fff' })
    tickCoop(s, 0.05)
    expect(a!.downed).toBe(true)
    expect(s.finished).toBe(false)

    // parceiro longe: não reanima
    b!.x = a!.x + 300
    for (let i = 0; i < 20; i++) tickCoop(s, 0.05)
    expect(a!.downed).toBe(true)

    // parceiro colado: reanima em ~2s
    b!.x = a!.x + 10
    b!.y = a!.y
    for (let i = 0; i < 45; i++) tickCoop(s, 0.05)
    expect(a!.downed).toBe(false)
    expect(a!.invincible).toBe(true)
  })

  it('modo juntos: os dois derrubados = fim cooperativo (sem vencedor)', () => {
    const s = cleanState('juntos')
    for (const p of s.planes) {
      s.enemyBullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 4, color: '#fff' })
    }
    tickCoop(s, 0.05)
    expect(s.finished).toBe(true)
    expect(s.draw).toBe(true)
  })

  it('modo lado-a-lado: 3 vidas por avião; fim decide pelo placar', () => {
    const s = cleanState('lado-a-lado')
    const [a, b] = s.planes
    b!.score = 500
    a!.score = 900
    // derruba A 3 vezes (com invencibilidade zerada entre elas)
    for (let hit = 0; hit < 3; hit++) {
      a!.invincibleT = 0
      s.enemyBullets.push({ x: a!.x, y: a!.y, vx: 0, vy: 0, r: 4, color: '#fff' })
      tickCoop(s, 0.05)
    }
    expect(a!.alive).toBe(false)
    expect(s.finished).toBe(false) // B continua

    for (let hit = 0; hit < 3; hit++) {
      b!.invincibleT = 0
      s.enemyBullets.push({ x: b!.x, y: b!.y, vx: 0, vy: 0, r: 4, color: '#fff' })
      tickCoop(s, 0.05)
    }
    expect(s.finished).toBe(true)
    expect(s.winnerSeats).toEqual([0]) // A tinha 900 × 500
  })

  it('loop deixa invulnerável enquanto dura', () => {
    const s = cleanState('juntos')
    const a = s.planes[0]!
    const r = applyCoopAction(s, 0, { type: 'loop' })
    expect('state' in r).toBe(true)
    s.enemyBullets.push({ x: a.x, y: a.y, vx: 0, vy: 0, r: 4, color: '#fff' })
    tickCoop(s, 0.05)
    expect(a.downed).toBe(false)
  })

  it('posição é limitada aos limites da tela', () => {
    const s = cleanState('juntos')
    applyCoopAction(s, 0, { type: 'pos', x: -500, y: 99999 })
    expect(s.planes[0]!.x).toBeGreaterThanOrEqual(14)
    expect(s.planes[0]!.y).toBeLessThanOrEqual(640)
  })
})

/* ------------------- integração: sala realtime ------------------- */

const runId = `coop${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let baseUrl = ''
let sockA: Socket
let sockB: Socket
const snapshots: CoopSnapshot[] = []

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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function registerUser(i: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}-p${i}@teste.mesapop.local`,
      name: `Piloto ${i}`,
      username: `u${runId}p${i}`,
      phone: '11987654321',
      password,
      passwordConfirm: password,
    },
  })
  return res.json().accessToken as string
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  await app.prisma.game.update({ where: { slug: 'esquadrao-coop' }, data: { isEnabled: true } })
  sockA = await connect(await registerUser(0))
  sockB = await connect(await registerUser(1))
  sockA.on('game:state', (p: { state: CoopSnapshot }) => snapshots.push(p.state))
})

afterAll(async () => {
  sockA?.disconnect()
  sockB?.disconnect()
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

describe('co-op: sala realtime', () => {
  it('cria sala com modo, dois entram, servidor transmite snapshots contínuos', async () => {
    const created = await emitAck<RoomView>(sockA, 'room:create', {
      gameSlug: 'esquadrao-coop',
      isPrivate: true,
      options: { mode: 'lado-a-lado' },
    })
    expect(created.ok).toBe(true)
    expect(created.data!.options).toEqual({ mode: 'lado-a-lado' })

    const joined = await emitAck<RoomView>(sockB, 'room:join', { code: created.data!.code })
    expect(joined.ok).toBe(true)

    const started = await emitAck(sockA, 'room:start')
    expect(started.ok).toBe(true)

    await wait(700)
    // ~10Hz → deve ter vários snapshots com o tempo avançando
    expect(snapshots.length).toBeGreaterThanOrEqual(4)
    const first = snapshots[0]!
    const last = snapshots[snapshots.length - 1]!
    expect(last.t).toBeGreaterThan(first.t)
    expect(last.mode).toBe('lado-a-lado')
    expect(last.planes).toHaveLength(2)

    // posição reportada aparece no snapshot seguinte (assento é sorteado —
    // basta que ALGUM avião esteja onde o jogador A reportou)
    await emitAck(sockA, 'game:action', { action: { type: 'pos', x: 111, y: 222 } })
    await wait(300)
    const snap = snapshots[snapshots.length - 1]!
    expect(
      snap.planes.some((p) => Math.round(p.x) === 111 && Math.round(p.y) === 222),
    ).toBe(true)
  })
})
