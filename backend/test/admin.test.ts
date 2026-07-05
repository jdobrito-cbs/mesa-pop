import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { hashPassword } from '../src/lib/password'

/**
 * Testes de integração do painel admin — exigem Postgres + migrações.
 * Cria um admin e um usuário comum próprios e limpa tudo no final.
 */

const runId = `adm${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `${runId}-admin@teste.mesapop.local`
const userEmail = `${runId}-user@teste.mesapop.local`
const password = 'Senha123'

let app: FastifyInstance
let adminToken = ''
let userToken = ''
let userId = ''

async function login(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', body: { email, password } })
  return res.json().accessToken as string
}

const asAdmin = () => ({ authorization: `Bearer ${adminToken}` })

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const passwordHash = await hashPassword(password)
  const admin = await app.prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin Teste',
      displayName: 'Admin Teste',
      phone: '11999990000',
      passwordHash,
      role: 'ADMIN',
    },
  })
  const user = await app.prisma.user.create({
    data: {
      email: userEmail,
      name: 'Usuário Comum',
      displayName: 'Usuário Comum',
      phone: '11999990001',
      passwordHash,
    },
  })
  userId = user.id
  void admin
  adminToken = await login(adminEmail)
  userToken = await login(userEmail)
})

afterAll(async () => {
  await app.prisma.announcement.deleteMany({ where: { title: { startsWith: runId } } })
  await app.prisma.user.deleteMany({ where: { email: { endsWith: '@teste.mesapop.local' } } })
  await app.close()
})

describe('proteção por role', () => {
  it('anônimo recebe 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats' })
    expect(res.statusCode).toBe(401)
  })
  it('usuário comum recebe 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: { authorization: `Bearer ${userToken}` },
    })
    expect(res.statusCode).toBe(403)
  })
  it('admin recebe 200 com métricas', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: asAdmin() })
    expect(res.statusCode).toBe(200)
    const stats = res.json()
    expect(stats.totalUsers).toBeGreaterThanOrEqual(2)
    expect(stats.gamesTotal).toBeGreaterThan(0)
  })
})

describe('CRUD de usuários', () => {
  it('lista com busca e paginação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/users?search=${runId}&perPage=1&page=1`,
      headers: asAdmin(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(2)
    expect(body.items).toHaveLength(1)
  })

  it('edita role e status; banimento revoga sessões', async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${userId}`,
      headers: asAdmin(),
      body: { bannedUntil: until, banReason: 'teste de banimento' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.banReason).toBe('teste de banimento')

    // banido não consegue mais logar
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: userEmail, password },
    })
    expect(loginRes.statusCode).toBe(403)
    expect(loginRes.json().error).toBe('ACCOUNT_BANNED')

    // sessões antigas foram revogadas
    const live = await app.prisma.refreshToken.count({
      where: { userId, revokedAt: null },
    })
    expect(live).toBe(0)

    // desbanir
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${userId}`,
      headers: asAdmin(),
      body: { bannedUntil: null, banReason: null },
    })
  })

  it('admin não pode rebaixar a si mesmo', async () => {
    const me = await app.prisma.user.findUnique({ where: { email: adminEmail } })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${me!.id}`,
      headers: asAdmin(),
      body: { role: 'USER' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('SELF_LOCKOUT')
  })

  it('cria e exclui usuário', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: asAdmin(),
      body: {
        email: `${runId}-novo@teste.mesapop.local`,
        name: 'Criado Pelo Admin',
        phone: '11999990002',
        password,
        role: 'USER',
      },
    })
    expect(created.statusCode).toBe(201)
    const id = created.json().user.id

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${id}`,
      headers: asAdmin(),
    })
    expect(deleted.statusCode).toBe(200)
  })

  it('exporta CSV', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/users/export.csv', headers: asAdmin() })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body).toContain(adminEmail)
  })
})

describe('jogos e lobby', () => {
  it('toggle habilita o jogo e ele aparece no lobby público', async () => {
    const games = await app.inject({ method: 'GET', url: '/api/admin/games', headers: asAdmin() })
    const damas = games.json().games.find((g: { slug: string }) => g.slug === 'damas')
    expect(damas).toBeTruthy()

    const on = await app.inject({
      method: 'PATCH',
      url: `/api/admin/games/${damas.id}`,
      headers: asAdmin(),
      body: { isEnabled: true },
    })
    expect(on.statusCode).toBe(200)

    const lobby = await app.inject({ method: 'GET', url: '/api/games' })
    expect(lobby.json().games.some((g: { slug: string }) => g.slug === 'damas')).toBe(true)

    // desabilita de volta e some do lobby
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/games/${damas.id}`,
      headers: asAdmin(),
      body: { isEnabled: false },
    })
    const lobby2 = await app.inject({ method: 'GET', url: '/api/games' })
    expect(lobby2.json().games.some((g: { slug: string }) => g.slug === 'damas')).toBe(false)
  })
})

describe('auditoria', () => {
  it('registra e filtra ações administrativas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/audit?action=admin.game.toggle&perPage=5`,
      headers: asAdmin(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBeGreaterThanOrEqual(2)
    expect(body.items[0].action).toBe('admin.game.toggle')
    expect(body.items[0].user.email).toBe(adminEmail)
  })
})

describe('avisos', () => {
  it('CRUD de aviso e exibição pública apenas dos ativos', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: asAdmin(),
      body: { title: `${runId} manutenção`, message: 'Sábado às 3h', isActive: true },
    })
    expect(created.statusCode).toBe(201)
    const id = created.json().announcement.id

    const pub = await app.inject({ method: 'GET', url: '/api/announcements' })
    expect(pub.json().announcements.some((a: { id: string }) => a.id === id)).toBe(true)

    await app.inject({
      method: 'PATCH',
      url: `/api/admin/announcements/${id}`,
      headers: asAdmin(),
      body: { isActive: false },
    })
    const pub2 = await app.inject({ method: 'GET', url: '/api/announcements' })
    expect(pub2.json().announcements.some((a: { id: string }) => a.id === id)).toBe(false)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/announcements/${id}`,
      headers: asAdmin(),
    })
    expect(del.statusCode).toBe(200)
  })
})

describe('rankings', () => {
  it('estrutura responde mesmo sem dados', async () => {
    const games = await app.inject({ method: 'GET', url: '/api/admin/rankings/games?days=30', headers: asAdmin() })
    expect(games.statusCode).toBe(200)
    expect(Array.isArray(games.json().rows)).toBe(true)

    const players = await app.inject({
      method: 'GET',
      url: '/api/admin/rankings/players?metric=wins&days=30',
      headers: asAdmin(),
    })
    expect(players.statusCode).toBe(200)
    expect(Array.isArray(players.json().rows)).toBe(true)
  })
})
