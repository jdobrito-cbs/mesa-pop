import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

const runId = `me${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let token = ''
beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}@t.local`, username: `u${runId}`, name: 'Maria', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123' } })
  token = r.json().accessToken
})
afterAll(async () => { await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } }); await app.close() })
const auth = () => ({ authorization: `Bearer ${token}` })

describe('me/avatar', () => {
  it('troca para um normal', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'n8' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().avatar).toBe('n8')
  })
  it('recusa especial/super (bloqueado na Fase A)', async () => {
    const esp = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'e10' } })
    expect(esp.statusCode).toBe(403)
    expect(esp.json().error).toBe('AVATAR_LOCKED')
  })
  it('recusa id inválido', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'zzz' } })
    expect(r.statusCode).toBe(400)
  })
  it('prompt-visto grava a data', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/me/avatar/prompt-visto', headers: auth() })
    expect(r.statusCode).toBe(200)
    const u = await app.prisma.user.findUnique({ where: { email: `${runId}@t.local` } })
    expect(u?.avatarPromptedAt).not.toBeNull()
  })
})
