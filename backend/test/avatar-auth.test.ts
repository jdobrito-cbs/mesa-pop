import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { avatarTier } from '@mesapop/shared'
import { buildApp } from '../src/app'

const runId = `av${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
beforeAll(async () => { app = await buildApp({ disableRateLimit: true, logger: false }) })
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: runId } }, { displayName: { startsWith: runId } }] } })
  await app.close()
})

describe('avatar no cadastro/convidado', () => {
  it('register salva o avatar normal escolhido', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}a@t.local`, username: `${runId}a`, name: 'Alice', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123', avatar: 'n5' } })
    expect(r.statusCode).toBe(201)
    expect(r.json().user.avatar).toBe('n5')
  })
  it('register sem avatar (ou inválido) cai num normal aleatório', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}b@t.local`, username: `${runId}b`, name: 'Bob', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123', avatar: 'e1' } })
    expect(r.statusCode).toBe(201)
    expect(avatarTier(r.json().user.avatar)).toBe('normal')
  })
  it('convidado recebe um normal', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: `${runId}guest` } })
    expect(r.statusCode).toBe(201)
    expect(avatarTier(r.json().user.avatar)).toBe('normal')
  })
})
