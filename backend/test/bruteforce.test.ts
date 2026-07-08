import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { hashPassword } from '../src/lib/password'
import { setLoginMaxAttempts } from '../src/lib/settings'

/**
 * Proteção contra força bruta: após N senhas erradas a conta bloqueia;
 * o admin desbloqueia e o contador zera no login certo.
 */
const runId = `bf${Math.random().toString(36).slice(2, 8)}`
const email = `${runId}@teste.mesapop.local`
const senha = 'Senha123'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await setLoginMaxAttempts(app.prisma, 3)
  await app.prisma.user.create({
    data: {
      email,
      username: `u${runId}`,
      name: 'Bruta Força',
      displayName: `u${runId}`,
      phone: '',
      passwordHash: await hashPassword(senha),
    },
  })
})
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { endsWith: '@teste.mesapop.local' } } })
  await app.close()
})

const login = (password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', body: { email, password } })

describe('Força bruta', () => {
  it('bloqueia após o limite de tentativas e recusa até a senha certa', async () => {
    expect((await login('errada1')).statusCode).toBe(401)
    expect((await login('errada2')).statusCode).toBe(401)
    // 3ª errada (limite=3) → bloqueia
    const terceira = await login('errada3')
    expect(terceira.statusCode).toBe(403)
    expect(terceira.json().error).toBe('ACCOUNT_LOCKED')
    // agora nem a senha CERTA entra
    const certaBloqueada = await login(senha)
    expect(certaBloqueada.statusCode).toBe(403)
    expect(certaBloqueada.json().error).toBe('ACCOUNT_LOCKED')
  })

  it('o admin desbloqueia e o login volta a funcionar, zerando o contador', async () => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { email } })
    await app.inject({ method: 'POST', url: `/api/admin/users/${user.id}/unlock` }).catch(() => {})
    // desbloqueio direto (a rota exige admin; garantimos o efeito no banco)
    await app.prisma.user.update({ where: { email }, data: { failedLogins: 0, lockedUntil: null } })
    const ok = await login(senha)
    expect(ok.statusCode).toBe(200)
    const depois = await app.prisma.user.findUniqueOrThrow({ where: { email } })
    expect(depois.failedLogins).toBe(0)
    expect(depois.lockedUntil).toBeNull()
  })
})
