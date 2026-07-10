import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { limparCacheRankings, posicoesDe } from '../src/lib/rankingsGerais'
import { hashPassword } from '../src/lib/password'

/**
 * Rankings GERAIS da plataforma (pontos somados de todos os jogos + tempo
 * jogado) e o desbloqueio posicional de avatares: top 10 = especiais,
 * nº1 = super. Convidados ficam de fora dos dois rankings.
 *
 * O banco de testes é compartilhado (rodam em série, sem reset entre
 * arquivos), então os testes usam somas MUITO grandes/distintas para
 * garantir a posição relativa independentemente de dados de outras
 * execuções — em vez de depender do conteúdo exato do top 10 real.
 */
const runId = `rk${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let gameId = ''

const userIds: string[] = []
const matchIds: string[] = []

async function registra(suf: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}${suf}@teste.mesapop.local`,
      username: `u${runId}${suf}`,
      name: `Rank ${suf}`,
      phone: '11987654321',
      password,
      passwordConfirm: password,
    },
  })
  const body = res.json()
  userIds.push(body.user.id)
  return { id: body.user.id as string, token: body.accessToken as string }
}

async function criaMatch(opts: {
  status?: 'IN_PROGRESS' | 'FINISHED'
  startedAt?: Date
  endedAt?: Date | null
  jogadores: { userId: string; score?: number }[]
}) {
  const m = await app.prisma.match.create({
    data: {
      gameId,
      status: opts.status ?? 'IN_PROGRESS',
      startedAt: opts.startedAt ?? new Date(),
      endedAt: opts.endedAt ?? null,
      players: { create: opts.jogadores.map((j) => ({ userId: j.userId, score: j.score ?? 0 })) },
    },
  })
  matchIds.push(m.id)
  return m.id
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const g = await app.prisma.game.findFirst({ select: { id: true } })
  gameId = g!.id
})

afterAll(async () => {
  await app.prisma.match.deleteMany({ where: { id: { in: matchIds } } }) // cascata: apaga os MatchPlayer
  await app.prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await app.close()
})

describe('Rankings gerais', () => {
  it('ranking de pontos ordena pela soma e exclui convidado com score alto', async () => {
    const a = await registra('a')
    const b = await registra('b')
    const guest = await app.prisma.user.create({
      data: {
        email: `${runId}guest@teste.mesapop.local`,
        name: 'Convidado Rank',
        displayName: 'Convidado Rank',
        phone: '',
        passwordHash: await hashPassword('!guest'),
        isGuest: true,
      },
    })
    userIds.push(guest.id)

    await criaMatch({ jogadores: [{ userId: a.id, score: 300 }] })
    await criaMatch({ jogadores: [{ userId: b.id, score: 200 }] })
    await criaMatch({ jogadores: [{ userId: guest.id, score: 999_999_999 }] })

    limparCacheRankings()
    const posA = await posicoesDe(app.prisma, a.id)
    const posB = await posicoesDe(app.prisma, b.id)
    const posGuest = await posicoesDe(app.prisma, guest.id)

    expect(posA.pontos).not.toBeNull()
    expect(posB.pontos).not.toBeNull()
    // A tem mais pontos que B → rank NUMÉRICO menor (posição melhor)
    expect(posA.pontos!).toBeLessThan(posB.pontos!)
    // convidado nunca entra no ranking, mesmo com o maior score de todos
    expect(posGuest.pontos).toBeNull()
  })

  it('ranking de tempo ordena pela duração somada', async () => {
    const a = await registra('ta')
    const b = await registra('tb')
    const t0 = new Date('2026-01-01T00:00:00Z')
    await criaMatch({
      status: 'FINISHED',
      startedAt: t0,
      endedAt: new Date(t0.getTime() + 5 * 60_000),
      jogadores: [{ userId: a.id }],
    })
    await criaMatch({
      status: 'FINISHED',
      startedAt: t0,
      endedAt: new Date(t0.getTime() + 1 * 60_000),
      jogadores: [{ userId: b.id }],
    })

    limparCacheRankings()
    const posA = await posicoesDe(app.prisma, a.id)
    const posB = await posicoesDe(app.prisma, b.id)

    expect(posA.tempo).not.toBeNull()
    expect(posB.tempo).not.toBeNull()
    expect(posA.tempo!).toBeLessThan(posB.tempo!)
  })

  it('GET /api/rankings/gerais devolve o top com rank/displayName/avatar e a posição de quem está logado', async () => {
    const camp = await registra('camp')
    await criaMatch({ jogadores: [{ userId: camp.id, score: 50_000_000 }] })
    limparCacheRankings()

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings/gerais',
      headers: { authorization: `Bearer ${camp.token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.pontos[0]).toMatchObject({ rank: 1, userId: camp.id })
    expect(body.pontos[0].displayName).toBeTruthy()
    expect('avatar' in body.pontos[0]).toBe(true)
    expect(body.voce.pontos).toBe(1)

    // sem sessão: continua público, só sem "voce"
    const semAuth = await app.inject({ method: 'GET', url: '/api/rankings/gerais' })
    expect(semAuth.statusCode).toBe(200)
    expect(semAuth.json().voce).toBeNull()
  })

  it('PUT /api/me/avatar: fora do top10 recusa; virar nº1 libera especial e super; 2º lugar só libera especial', async () => {
    const fora = await registra('fora')
    const auth1 = { authorization: `Bearer ${fora.token}` }

    const r1 = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth1, body: { id: 'e5' } })
    expect(r1.statusCode).toBe(403)
    expect(r1.json().error).toBe('AVATAR_LOCKED')

    // vira o nº1 do ranking de pontos (soma gigante, garantidamente a maior)
    await criaMatch({ jogadores: [{ userId: fora.id, score: 60_000_000 }] })
    limparCacheRankings()

    const r2 = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth1, body: { id: 'e5' } })
    expect(r2.statusCode).toBe(200)
    expect(r2.json().avatar).toBe('e5')
    const r3 = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth1, body: { id: 's3' } })
    expect(r3.statusCode).toBe(200)
    expect(r3.json().avatar).toBe('s3')

    // 2º usuário: top10 garantido (soma grande, mas menor que o do nº1), não é o nº1
    const segundo = await registra('seg')
    const auth2 = { authorization: `Bearer ${segundo.token}` }
    await criaMatch({ jogadores: [{ userId: segundo.id, score: 40_000_000 }] })
    limparCacheRankings()

    const r4 = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth2, body: { id: 'e7' } })
    expect(r4.statusCode).toBe(200)
    expect(r4.json().avatar).toBe('e7')
    const r5 = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth2, body: { id: 's2' } })
    expect(r5.statusCode).toBe(403)
    expect(r5.json().error).toBe('AVATAR_LOCKED')
  })
})
