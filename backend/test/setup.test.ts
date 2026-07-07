import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

/**
 * Setup inicial — o banco de dev já tem admin (seed), então aqui a
 * garantia principal é a de SEGURANÇA: com um admin existente, /setup
 * se fecha e recusa criar outro. Também confere o formato do status.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
})
afterAll(async () => {
  await app.close()
})

describe('Configuração inicial', () => {
  it('status informa needsSetup como booleano', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/setup/status' })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().needsSetup).toBe('boolean')
  })

  it('status e a recusa são coerentes com a existência de admin', async () => {
    const temAdmin = (await app.prisma.user.count({ where: { role: 'ADMIN' } })) > 0
    const status = (await app.inject({ method: 'GET', url: '/api/setup/status' })).json()
    expect(status.needsSetup).toBe(!temAdmin)

    if (temAdmin) {
      // com admin já existente, criar outro pelo setup é proibido
      const res = await app.inject({
        method: 'POST',
        url: '/api/setup/admin',
        body: {
          email: 'setup-invasor@teste.mesapop.local',
          username: 'invasor',
          name: 'Invasor',
          password: 'Senha123',
          passwordConfirm: 'Senha123',
        },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().error).toBe('SETUP_DONE')
    }
  })
})
