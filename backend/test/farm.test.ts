import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

/** Fazenda Pop: economia validada pelo servidor. Exige Postgres. */

const runId = `farm${Math.random().toString(36).slice(2, 8)}`
const password = 'Senha123'
let app: FastifyInstance
let token = ''
let userId = ''

const auth = () => ({ authorization: `Bearer ${token}` })

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}@teste.mesapop.local`,
      name: 'Fazendeira Teste',
      phone: '11987654321',
      password,
      passwordConfirm: password,
    },
  })
  token = res.json().accessToken
  userId = res.json().user.id
})

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

describe('fazenda persistente', () => {
  it('cria a fazenda no primeiro acesso: 50 moedas e 4 canteiros', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/farm', headers: auth() })
    expect(res.statusCode).toBe(200)
    const farm = res.json()
    expect(farm.coins).toBe(50)
    expect(farm.plots).toHaveLength(4)
    expect(farm.catalog.length).toBeGreaterThanOrEqual(5)
  })

  it('planta descontando moedas; canteiro ocupado e moeda curta são recusados', async () => {
    const plant = await app.inject({
      method: 'POST',
      url: '/api/farm/plant',
      headers: auth(),
      body: { plotId: 0, crop: 'cenoura' },
    })
    expect(plant.statusCode).toBe(200)
    expect(plant.json().coins).toBe(40)
    expect(plant.json().plots[0].crop.slug).toBe('cenoura')

    const busy = await app.inject({
      method: 'POST',
      url: '/api/farm/plant',
      headers: auth(),
      body: { plotId: 0, crop: 'cenoura' },
    })
    expect(busy.statusCode).toBe(400)
    expect(busy.json().error).toBe('BUSY')

    const expensive = await app.inject({
      method: 'POST',
      url: '/api/farm/plant',
      headers: auth(),
      body: { plotId: 1, crop: 'cacau' }, // 400 moedas — só temos 40
    })
    expect(expensive.statusCode).toBe(400)
    expect(expensive.json().error).toBe('NO_COINS')
  })

  it('colher ANTES da hora é rejeitado pelo relógio do servidor', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/farm/harvest',
      headers: auth(),
      body: { plotId: 0 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('NOT_READY')
  })

  it('crescimento offline: plantedAt no passado → colheita paga a venda', async () => {
    // viaja no tempo: a cenoura foi plantada há 2 minutos
    const farm = await app.prisma.farm.findUnique({ where: { userId } })
    const plots = farm!.plots as Array<{ id: number; crop: string | null; plantedAt: string | null }>
    plots[0]!.plantedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    await app.prisma.farm.update({ where: { userId }, data: { plots } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/farm/harvest',
      headers: auth(),
      body: { plotId: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.harvested.name).toBe('Cenoura')
    expect(body.coins).toBe(40 + 16)
    expect(body.plots[0].crop).toBeNull()
  })

  it('compra canteiro novo com preço crescente; sem moedas é recusado', async () => {
    // dá moedas para o teste
    await app.prisma.farm.update({ where: { userId }, data: { coins: 500 } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/farm/buy',
      headers: auth(),
      body: { upgrade: 'plot' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().plots).toHaveLength(5)
    expect(res.json().coins).toBe(500 - 90)

    await app.prisma.farm.update({ where: { userId }, data: { coins: 1 } })
    const poor = await app.inject({
      method: 'POST',
      url: '/api/farm/buy',
      headers: auth(),
      body: { upgrade: 'fertilizer' },
    })
    expect(poor.statusCode).toBe(400)
    expect(poor.json().error).toBe('NO_COINS')
  })

  it('adubo acelera o crescimento (readyAt mais cedo)', async () => {
    await app.prisma.farm.update({ where: { userId }, data: { coins: 5000 } })
    const before = await app.inject({
      method: 'POST',
      url: '/api/farm/plant',
      headers: auth(),
      body: { plotId: 1, crop: 'milho' },
    })
    const readyBefore = new Date(before.json().plots[1].readyAt).getTime()
    // compra 1 nível de adubo e replanta em outro canteiro
    await app.inject({ method: 'POST', url: '/api/farm/buy', headers: auth(), body: { upgrade: 'fertilizer' } })
    const after = await app.inject({
      method: 'POST',
      url: '/api/farm/plant',
      headers: auth(),
      body: { plotId: 2, crop: 'milho' },
    })
    const readyAfter = new Date(after.json().plots[2].readyAt).getTime()
    const plantedAfter = new Date(after.json().plots[2].plantedAt).getTime()
    const plantedBefore = new Date(before.json().plots[1].plantedAt).getTime()
    expect(readyAfter - plantedAfter).toBeLessThan(readyBefore - plantedBefore)
  })
})
