import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { creditarSegundos, zerarAcumulo } from '../src/lib/fichas'

/**
 * Fase D: acúmulo de fichas por presença (1 a cada 5 min online) + troca
 * atômica de 1000 fichas por um avatar ESPECIAL sorteado (posse permanente).
 */
const runId = `fic2${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let userId = ''
let token = ''

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}@t.local`,
      username: `u${runId}`,
      name: 'Fulana',
      phone: '11987654321',
      password: 'Senha123',
      passwordConfirm: 'Senha123',
    },
  })
  token = r.json().accessToken
  userId = r.json().user.id
})

beforeEach(async () => {
  zerarAcumulo()
  await app.prisma.user.update({ where: { id: userId }, data: { fichas: 0 } })
})

afterAll(async () => {
  await app.prisma.avatarOwned.deleteMany({ where: { userId } })
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('fichas — acúmulo por presença', () => {
  it('300s credita 1 ficha', async () => {
    await creditarSegundos(app.prisma, [userId], 300)
    const u = await app.prisma.user.findUnique({ where: { id: userId } })
    expect(u?.fichas).toBe(1)
  })

  it('3x100s credita 1 ficha (fração acumula em memória)', async () => {
    await creditarSegundos(app.prisma, [userId], 100)
    await creditarSegundos(app.prisma, [userId], 100)
    let u = await app.prisma.user.findUnique({ where: { id: userId } })
    expect(u?.fichas).toBe(0)
    await creditarSegundos(app.prisma, [userId], 100)
    u = await app.prisma.user.findUnique({ where: { id: userId } })
    expect(u?.fichas).toBe(1)
  })

  it('convidado não ganha fichas', async () => {
    const nome = `Convidado ${runId}`
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: nome } })
    expect(g.statusCode).toBe(201)
    const guestId = g.json().user.id as string
    await creditarSegundos(app.prisma, [guestId], 600)
    const u = await app.prisma.user.findUnique({ where: { id: guestId } })
    expect(u?.fichas).toBe(0)
    await app.prisma.user.deleteMany({ where: { id: guestId } })
  })
})

describe('fichas — troca por avatar especial', () => {
  it('sem saldo → 400 SEM_FICHAS', async () => {
    await app.prisma.user.update({ where: { id: userId }, data: { fichas: 0 } })
    const r = await app.inject({ method: 'POST', url: '/api/fichas/trocar', headers: auth() })
    expect(r.statusCode).toBe(400)
    expect(r.json().error).toBe('SEM_FICHAS')
  })

  it('2000 fichas → 2 trocas seguidas, avatares diferentes, saldo zera', async () => {
    await app.prisma.user.update({ where: { id: userId }, data: { fichas: 2000 } })

    const r1 = await app.inject({ method: 'POST', url: '/api/fichas/trocar', headers: auth() })
    expect(r1.statusCode).toBe(200)
    const avatar1 = r1.json().avatar as string
    expect(avatar1).toMatch(/^e\d+$/)
    expect(r1.json().fichas).toBe(1000)

    const r2 = await app.inject({ method: 'POST', url: '/api/fichas/trocar', headers: auth() })
    expect(r2.statusCode).toBe(200)
    const avatar2 = r2.json().avatar as string
    expect(avatar2).not.toBe(avatar1)
    expect(r2.json().fichas).toBe(0)

    const owned = await app.prisma.avatarOwned.findMany({ where: { userId } })
    expect(owned).toHaveLength(2)

    // o avatar sorteado é sempre equipável, mesmo sem posição no ranking
    const eq = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: avatar1 } })
    expect(eq.statusCode).toBe(200)
    expect(eq.json().avatar).toBe(avatar1)
  })

  it('convidado é recusado (403)', async () => {
    const nome = `Convidado2 ${runId}`
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: nome } })
    const guestToken = g.json().accessToken
    const r = await app.inject({
      method: 'POST',
      url: '/api/fichas/trocar',
      headers: { authorization: `Bearer ${guestToken}` },
    })
    expect(r.statusCode).toBe(403)
    expect(r.json().error).toBe('LOGIN_REQUIRED')
    await app.prisma.user.deleteMany({ where: { id: g.json().user.id } })
  })
})

describe('fichas — GET /api/me/avatares', () => {
  it('devolve fichas + owned + melhorPosicao', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/me/avatares', headers: auth() })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(typeof body.fichas).toBe('number')
    expect(Array.isArray(body.owned)).toBe(true)
    expect(body.owned.length).toBeGreaterThanOrEqual(2)
    expect('melhorPosicao' in body).toBe(true)
  })
})
