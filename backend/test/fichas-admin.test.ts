import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { hashPassword } from '../src/lib/password'

/**
 * Fichas (moeda da plataforma): admin ganha 100.000 ao ser promovido (ou ao
 * ser criado como admin), e o painel de usuários pode dar +1.000 fichas
 * para um usuário cadastrado. Convidados não têm carteira de fichas.
 */
const runId = `fic${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `${runId}-admin@teste.mesapop.local`
const password = 'Senha123'

let app: FastifyInstance
let adminToken = ''

const asAdmin = () => ({ authorization: `Bearer ${adminToken}` })

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin Fichas',
      displayName: 'Admin Fichas',
      phone: '',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  })
  adminToken = (
    await app.inject({ method: 'POST', url: '/api/auth/login', body: { email: adminEmail, password } })
  ).json().accessToken
})

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { endsWith: '@teste.mesapop.local' } } })
  await app.close()
})

describe('Fichas — admin', () => {
  it('promover a admin dá 100.000 fichas (e não soma de novo se já for admin)', async () => {
    const email = `${runId}-promovido@teste.mesapop.local`
    const registro = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: {
        email,
        username: `${runId}promovido`,
        name: 'Usuário Promovido',
        phone: '11999999999',
        password,
        passwordConfirm: password,
      },
    })
    expect(registro.statusCode).toBe(201)
    const userId = registro.json().user.id as string

    const promovido = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${userId}`,
      headers: asAdmin(),
      body: { role: 'ADMIN' },
    })
    expect(promovido.statusCode).toBe(200)
    expect(promovido.json().user.fichas).toBeGreaterThanOrEqual(100_000)

    // PATCH de novo com role ADMIN (sem mudança de estado) não soma outra vez
    const semMudanca = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${userId}`,
      headers: asAdmin(),
      body: { role: 'ADMIN' },
    })
    expect(semMudanca.statusCode).toBe(200)
    expect(semMudanca.json().user.fichas).toBe(promovido.json().user.fichas)
  })

  it('+1.000 fichas pelo painel (acumula em chamadas repetidas)', async () => {
    const email = `${runId}-comum@teste.mesapop.local`
    const registro = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: {
        email,
        username: `${runId}comum`,
        name: 'Usuário Comum',
        phone: '11999999999',
        password,
        passwordConfirm: password,
      },
    })
    const userId = registro.json().user.id as string

    const primeira = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/fichas`,
      headers: asAdmin(),
    })
    expect(primeira.statusCode).toBe(200)
    expect(primeira.json().user.fichas).toBe(1000)

    const segunda = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/fichas`,
      headers: asAdmin(),
    })
    expect(segunda.statusCode).toBe(200)
    expect(segunda.json().user.fichas).toBe(2000)
  })

  it('convidado é recusado (sem carteira de fichas)', async () => {
    const nome = `Convidado ${runId}`
    const convidado = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: nome } })
    expect(convidado.statusCode).toBe(201)
    const guestId = convidado.json().user.id as string

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${guestId}/fichas`,
      headers: asAdmin(),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('GUEST_NO_FICHAS')

    await app.prisma.user.deleteMany({ where: { isGuest: true, displayName: nome } })
  })
})
