import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { REFRESH_COOKIE } from '../src/config'

/**
 * Testes de integração do auth — exigem Postgres rodando (docker compose up db)
 * e migrações aplicadas. Usam e-mails únicos e limpam tudo no final.
 */

const runId = `t${Math.random().toString(36).slice(2, 10)}`
const email = `${runId}@teste.mesapop.local`
const password = 'Senha123'
const registerBody = {
  email,
  name: 'Usuário de Teste',
  phone: '11987654321',
  password,
  passwordConfirm: password,
}

let app: FastifyInstance

function refreshCookieFrom(res: { cookies: Array<{ name: string; value: string }> }) {
  return res.cookies.find((c) => c.name === REFRESH_COOKIE)?.value
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
})

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { endsWith: '@teste.mesapop.local' } } })
  await app.close()
})

describe('POST /api/auth/register', () => {
  it('cadastra usuário, retorna token e seta cookie de refresh', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', body: registerBody })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.user.email).toBe(email)
    expect(body.user.role).toBe('USER')
    expect(body.accessToken).toBeTruthy()
    expect(body.user.passwordHash).toBeUndefined()
    expect(refreshCookieFrom(res)).toBeTruthy()
  })

  it('rejeita e-mail duplicado com 409', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', body: registerBody })
    expect(res.statusCode).toBe(409)
  })

  it('rejeita senha fraca com 400 e detalhes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: { ...registerBody, email: `${runId}-2@teste.mesapop.local`, password: 'fraca', passwordConfirm: 'fraca' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('VALIDATION')
  })

  it('grava auditoria do cadastro', async () => {
    const user = await app.prisma.user.findUnique({ where: { email } })
    const log = await app.prisma.auditLog.findFirst({
      where: { userId: user!.id, action: 'user.register' },
    })
    expect(log).not.toBeNull()
  })
})

describe('POST /api/auth/login', () => {
  it('autentica com credenciais corretas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().accessToken).toBeTruthy()
  })

  it('rejeita senha errada com 401 (sem vazar qual campo)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password: 'Errada123' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('INVALID_CREDENTIALS')
  })
})

describe('fluxo refresh + me + logout', () => {
  it('refresh rotaciona o token e o antigo deixa de valer', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    })
    const oldRefresh = refreshCookieFrom(login)!

    const refresh1 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: oldRefresh },
    })
    expect(refresh1.statusCode).toBe(200)
    expect(refresh1.json().accessToken).toBeTruthy()

    // reuso do token antigo deve falhar (rotação)
    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: oldRefresh },
    })
    expect(replay.statusCode).toBe(401)
  })

  it('GET /me exige token e retorna o usuário', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(anon.statusCode).toBe(401)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    })
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${login.json().accessToken}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().user.email).toBe(email)
  })

  it('logout revoga o refresh token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    })
    const refresh = refreshCookieFrom(login)!

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [REFRESH_COOKIE]: refresh },
    })
    expect(logout.statusCode).toBe(200)

    const after = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: refresh },
    })
    expect(after.statusCode).toBe(401)
  })
})
