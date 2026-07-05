import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

/**
 * Leaderboard single-player validado no servidor. Exige Postgres.
 */

const runId = `solo${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let token = ''
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.prisma.game.update({ where: { slug: 'nave-espacial' }, data: { isEnabled: true } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}@teste.mesapop.local`,
      name: 'Piloto Teste',
      phone: '11987654321',
      password,
      passwordConfirm: password,
    },
  })
  token = res.json().accessToken
})

afterAll(async () => {
  const testUsers = { email: { startsWith: runId } }
  const matchIds = await app.prisma.matchPlayer.findMany({
    where: { user: testUsers },
    select: { matchId: true },
  })
  await app.prisma.match.deleteMany({ where: { id: { in: matchIds.map((m) => m.matchId) } } })
  await app.prisma.user.deleteMany({ where: testUsers })
  await app.close()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('partida solo com score validado', () => {
  it('exige login para começar', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/solo/start',
      body: { gameSlug: 'nave-espacial' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('recusa jogo desabilitado ou multiplayer', async () => {
    const dis = await app.inject({
      method: 'POST',
      url: '/api/solo/start',
      headers: auth(),
      body: { gameSlug: 'fazenda' },
    })
    expect(dis.statusCode).toBe(400)
    const multi = await app.inject({
      method: 'POST',
      url: '/api/solo/start',
      headers: auth(),
      body: { gameSlug: 'damas' },
    })
    expect(multi.statusCode).toBe(400)
  })

  it('recusa pontuação implausível (rápida demais / alta demais)', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/solo/start',
      headers: auth(),
      body: { gameSlug: 'nave-espacial' },
    })
    expect(start.statusCode).toBe(201)
    const { matchId } = start.json()

    // terminar imediatamente com pontuação alta: impossível
    const cheat = await app.inject({
      method: 'POST',
      url: '/api/solo/finish',
      headers: auth(),
      body: { matchId, points: 999999 },
    })
    expect(cheat.statusCode).toBe(422)
    expect(cheat.json().error).toBe('IMPLAUSIBLE_SCORE')

    // a partida foi descartada — não dá para reaproveitar
    const retry = await app.inject({
      method: 'POST',
      url: '/api/solo/finish',
      headers: auth(),
      body: { matchId, points: 10 },
    })
    expect(retry.statusCode).toBe(400)
  })

  it('aceita pontuação plausível e entra no leaderboard', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/solo/start',
      headers: auth(),
      body: { gameSlug: 'nave-espacial' },
    })
    const { matchId } = start.json()

    await wait(3100) // sobrevive ~3s (mínimo do jogo)

    const finish = await app.inject({
      method: 'POST',
      url: '/api/solo/finish',
      headers: auth(),
      body: { matchId, points: 30 }, // ~10 pts/s: plausível
    })
    expect(finish.statusCode).toBe(200)
    const body = finish.json()
    expect(body.best).toBeGreaterThanOrEqual(30)
    expect(body.rank).toBeGreaterThanOrEqual(1)

    const lb = await app.inject({ method: 'GET', url: '/api/leaderboards/nave-espacial' })
    expect(lb.statusCode).toBe(200)
    const rows = lb.json().rows as Array<{ displayName: string; points: number }>
    expect(rows.some((r) => r.displayName === 'Piloto Teste' && r.points === 30)).toBe(true)
  })
})
