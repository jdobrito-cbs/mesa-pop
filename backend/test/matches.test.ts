import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { abandonarPartidasOrfas, fecharSalasOrfas, reapSoloParadas } from '../src/lib/matches'

/** higiene das partidas "em andamento" — reaper de solo travado + órfãs no boot */
let app: FastifyInstance
let gameId = ''
let hostId = ''
const criadas: string[] = []
const salas: string[] = []

async function criaMatch(status: 'IN_PROGRESS', roomId: string | null, startedAt: Date) {
  const m = await app.prisma.match.create({ data: { gameId, status, roomId, startedAt } })
  criadas.push(m.id)
  return m.id
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const g = await app.prisma.game.findFirst({ select: { id: true } })
  gameId = g!.id
  const u = await app.prisma.user.findFirst({ select: { id: true } })
  hostId = u!.id
})
afterAll(async () => {
  await app.prisma.match.deleteMany({ where: { id: { in: criadas } } })
  await app.prisma.room.deleteMany({ where: { id: { in: salas } } })
  await app.close()
})

describe('Higiene de partidas', () => {
  it('reapSoloParadas abandona só as solo paradas além do limite', async () => {
    const velha = await criaMatch('IN_PROGRESS', null, new Date(Date.now() - 40 * 60_000))
    const nova = await criaMatch('IN_PROGRESS', null, new Date())
    await reapSoloParadas(app.prisma, 30)
    const v = await app.prisma.match.findUnique({ where: { id: velha } })
    const n = await app.prisma.match.findUnique({ where: { id: nova } })
    expect(v?.status).toBe('ABANDONED')
    expect(n?.status).toBe('IN_PROGRESS') // recente segue em andamento
  })

  it('abandonarPartidasOrfas encerra tudo que estava IN_PROGRESS (boot)', async () => {
    const m = await criaMatch('IN_PROGRESS', null, new Date())
    const n = await abandonarPartidasOrfas(app.prisma)
    expect(n).toBeGreaterThanOrEqual(1)
    const depois = await app.prisma.match.findUnique({ where: { id: m } })
    expect(depois?.status).toBe('ABANDONED')
  })

  it('fecharSalasOrfas fecha salas WAITING/PLAYING no boot', async () => {
    const sala = await app.prisma.room.create({
      data: { code: `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`, gameId, hostId, maxPlayers: 2, status: 'WAITING' },
    })
    salas.push(sala.id)
    const n = await fecharSalasOrfas(app.prisma)
    expect(n).toBeGreaterThanOrEqual(1)
    const depois = await app.prisma.room.findUnique({ where: { id: sala.id } })
    expect(depois?.status).toBe('CLOSED')
  })
})
