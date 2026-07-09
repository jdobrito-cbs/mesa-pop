import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

/**
 * Desafio Diário — uma tentativa por jogo por dia, seed = a data, ranking
 * do dia. Como os jogos diários têm minMs longo (20–30s), o caminho de
 * sucesso é testado RETROAGINDO o startedAt no banco (em vez de esperar).
 * Exige Postgres.
 */

const runId = `des${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let token = ''
let userId = ''

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  for (const slug of ['sudoku', 'caca-palavras', 'cruzadinha', 'mahjong']) {
    await app.prisma.game.update({ where: { slug }, data: { isEnabled: true } })
  }
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}@teste.mesapop.local`,
      name: 'Desafiante Teste',
      phone: '11987654321',
      username: `u${runId}`,
      password,
      passwordConfirm: password,
    },
  })
  token = res.json().accessToken
  userId = res.json().user.id
})

afterAll(async () => {
  await app.prisma.desafioPlay.deleteMany({ where: { userId } })
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('Desafio Diário', () => {
  it('exige login e devolve a data + status do dia', async () => {
    const semAuth = await app.inject({ method: 'GET', url: '/api/desafio/hoje' })
    expect(semAuth.statusCode).toBe(401)

    const res = await app.inject({ method: 'GET', url: '/api/desafio/hoje', headers: auth() })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.date).toBe(hoje())
    expect(body.jogos.length).toBe(4)
    expect(body.jogos.every((j: { done: boolean }) => j.done === false)).toBe(true)
  })

  it('recusa slug fora do desafio diário', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/desafio/start',
      headers: auth(),
      body: { gameSlug: 'xadrez' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('recusa finish sem ter começado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/desafio/finish',
      headers: auth(),
      body: { gameSlug: 'cruzadinha', points: 500 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('NOT_STARTED')
  })

  it('fluxo completo: começa, valida duração, fecha uma vez, entra no ranking', async () => {
    const slug = 'sudoku'
    const start = await app.inject({
      method: 'POST',
      url: '/api/desafio/start',
      headers: auth(),
      body: { gameSlug: slug },
    })
    expect(start.statusCode).toBe(201)

    // rápido demais (elapsed ~0 < minMs) → recusado, SEM queimar a tentativa
    const cedo = await app.inject({
      method: 'POST',
      url: '/api/desafio/finish',
      headers: auth(),
      body: { gameSlug: slug, points: 900 },
    })
    expect(cedo.statusCode).toBe(422)
    const aindaAberto = await app.inject({ method: 'GET', url: '/api/desafio/hoje', headers: auth() })
    expect(aindaAberto.json().jogos.find((j: { slug: string }) => j.slug === slug).done).toBe(false)

    // retroage o cronômetro do servidor (60s atrás) e fecha com pontos plausíveis
    await app.prisma.desafioPlay.update({
      where: { userId_gameSlug_date: { userId, gameSlug: slug, date: hoje() } },
      data: { startedAt: new Date(Date.now() - 60_000) },
    })
    const fim = await app.inject({
      method: 'POST',
      url: '/api/desafio/finish',
      headers: auth(),
      body: { gameSlug: slug, points: 900 },
    })
    expect(fim.statusCode).toBe(200)
    expect(fim.json().points).toBe(900)
    // rank >= 1 (o banco é compartilhado; outros jogadores do dia podem existir)
    expect(fim.json().rank).toBeGreaterThanOrEqual(1)

    // segunda tentativa no mesmo dia é barrada
    const denovo = await app.inject({
      method: 'POST',
      url: '/api/desafio/finish',
      headers: auth(),
      body: { gameSlug: slug, points: 2000 },
    })
    expect(denovo.statusCode).toBe(409)

    // e nem começar de novo
    const restart = await app.inject({
      method: 'POST',
      url: '/api/desafio/start',
      headers: auth(),
      body: { gameSlug: slug },
    })
    expect(restart.statusCode).toBe(409)

    // status do dia e ranking refletem a conclusão
    const status = await app.inject({ method: 'GET', url: '/api/desafio/hoje', headers: auth() })
    const doSlug = status.json().jogos.find((j: { slug: string }) => j.slug === slug)
    expect(doSlug.done).toBe(true)
    expect(doSlug.points).toBe(900)

    const rank = await app.inject({ method: 'GET', url: `/api/desafio/ranking/${slug}` })
    expect(rank.statusCode).toBe(200)
    expect(rank.json().rows.some((r: { userId: string }) => r.userId === userId)).toBe(true)
  })
})
