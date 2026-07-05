import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

/**
 * Fazenda Pop — economia persistente com o TEMPO DO SERVIDOR.
 * Plantou às 14h, colhe às 18h: o crescimento é derivado de plantedAt,
 * então funciona com o jogador offline. Toda validação (moedas, prontidão,
 * preços) acontece aqui — o cliente só apresenta.
 */

export interface CropDef {
  slug: string
  name: string
  icon: string
  cost: number
  sell: number
  /** tempo de crescimento em segundos */
  growSecs: number
}

export const CROPS: CropDef[] = [
  { slug: 'cenoura', name: 'Cenoura', icon: '🥕', cost: 10, sell: 16, growSecs: 60 },
  { slug: 'milho', name: 'Milho', icon: '🌽', cost: 25, sell: 46, growSecs: 5 * 60 },
  { slug: 'morango', name: 'Morango', icon: '🍓', cost: 60, sell: 125, growSecs: 20 * 60 },
  { slug: 'abobora', name: 'Abóbora', icon: '🎃', cost: 150, sell: 360, growSecs: 2 * 3600 },
  { slug: 'cacau', name: 'Cacau', icon: '🍫', cost: 400, sell: 1150, growSecs: 8 * 3600 },
]

const START_PLOTS = 4
const MAX_PLOTS = 12
const MAX_FERTILIZER = 5

export const plotPrice = (owned: number) => Math.round(90 * Math.pow(1.65, owned - START_PLOTS))
export const fertilizerPrice = (level: number) => 180 * Math.pow(2, level)
/** adubo: -8% de tempo por nível */
export const growthFactor = (fertilizer: number) => Math.pow(0.92, fertilizer)

interface Plot {
  id: number
  crop: string | null
  plantedAt: string | null
}

interface Upgrades {
  fertilizer: number
}

function freshPlots(): Plot[] {
  return Array.from({ length: START_PLOTS }, (_, i) => ({ id: i, crop: null, plantedAt: null }))
}

export default async function farmRoutes(app: FastifyInstance) {
  async function loadFarm(userId: string) {
    let farm = await app.prisma.farm.findUnique({ where: { userId } })
    if (!farm) {
      farm = await app.prisma.farm.create({
        data: { userId, plots: freshPlots(), upgrades: { fertilizer: 0 } },
      })
    }
    return farm
  }

  function view(farm: { coins: number; plots: unknown; upgrades: unknown }) {
    const now = Date.now()
    const plots = farm.plots as Plot[]
    const upgrades = farm.upgrades as Upgrades
    const factor = growthFactor(upgrades.fertilizer)
    return {
      coins: farm.coins,
      upgrades,
      plots: plots.map((p) => {
        const crop = p.crop ? CROPS.find((c) => c.slug === p.crop) : null
        const plantedAt = p.plantedAt ? new Date(p.plantedAt).getTime() : null
        const growMs = crop ? crop.growSecs * 1000 * factor : 0
        const readyAt = plantedAt !== null ? plantedAt + growMs : null
        return {
          id: p.id,
          crop: crop ? { slug: crop.slug, name: crop.name, icon: crop.icon, sell: crop.sell } : null,
          plantedAt: p.plantedAt,
          readyAt: readyAt !== null ? new Date(readyAt).toISOString() : null,
          isReady: readyAt !== null && now >= readyAt,
          progress: readyAt !== null && plantedAt !== null
            ? Math.min(1, (now - plantedAt) / Math.max(growMs, 1))
            : 0,
        }
      }),
      catalog: CROPS,
      shop: {
        plot: plots.length < MAX_PLOTS ? { price: plotPrice(plots.length), owned: plots.length, max: MAX_PLOTS } : null,
        fertilizer:
          upgrades.fertilizer < MAX_FERTILIZER
            ? { price: fertilizerPrice(upgrades.fertilizer), level: upgrades.fertilizer, max: MAX_FERTILIZER }
            : null,
      },
      serverTime: new Date(now).toISOString(),
    }
  }

  app.get('/api/farm', { preHandler: [app.authenticate] }, async (req) => {
    const farm = await loadFarm(req.auth!.sub)
    return view(farm)
  })

  app.post('/api/farm/plant', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { plotId, crop } = z
      .object({ plotId: z.number().int().min(0), crop: z.string() })
      .parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const plots = farm.plots as Plot[]
    const plot = plots.find((p) => p.id === plotId)
    const def = CROPS.find((c) => c.slug === crop)
    if (!plot) return reply.code(400).send({ error: 'NO_PLOT', message: 'Canteiro inválido' })
    if (!def) return reply.code(400).send({ error: 'NO_CROP', message: 'Semente desconhecida' })
    if (plot.crop) return reply.code(400).send({ error: 'BUSY', message: 'Este canteiro já está plantado' })
    if (farm.coins < def.cost) {
      return reply.code(400).send({ error: 'NO_COINS', message: 'Moedas insuficientes' })
    }
    plot.crop = def.slug
    plot.plantedAt = new Date().toISOString()
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins - def.cost, plots },
    })
    return view(updated)
  })

  app.post('/api/farm/harvest', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { plotId } = z.object({ plotId: z.number().int().min(0) }).parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const plots = farm.plots as Plot[]
    const upgrades = farm.upgrades as Upgrades
    const plot = plots.find((p) => p.id === plotId)
    if (!plot?.crop || !plot.plantedAt) {
      return reply.code(400).send({ error: 'EMPTY', message: 'Nada plantado aqui' })
    }
    const def = CROPS.find((c) => c.slug === plot.crop)!
    const readyAt =
      new Date(plot.plantedAt).getTime() + def.growSecs * 1000 * growthFactor(upgrades.fertilizer)
    // o SERVIDOR decide se está pronto — nada de colher antes da hora
    if (Date.now() < readyAt) {
      return reply.code(400).send({ error: 'NOT_READY', message: 'Ainda está crescendo!' })
    }
    plot.crop = null
    plot.plantedAt = null
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins + def.sell, plots },
    })
    return { ...view(updated), harvested: { name: def.name, icon: def.icon, sell: def.sell } }
  })

  app.post('/api/farm/buy', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { upgrade } = z.object({ upgrade: z.enum(['plot', 'fertilizer']) }).parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const plots = farm.plots as Plot[]
    const upgrades = farm.upgrades as Upgrades

    if (upgrade === 'plot') {
      if (plots.length >= MAX_PLOTS) {
        return reply.code(400).send({ error: 'MAXED', message: 'A fazenda já está no tamanho máximo' })
      }
      const price = plotPrice(plots.length)
      if (farm.coins < price) {
        return reply.code(400).send({ error: 'NO_COINS', message: 'Moedas insuficientes' })
      }
      plots.push({ id: Math.max(...plots.map((p) => p.id)) + 1, crop: null, plantedAt: null })
      const updated = await app.prisma.farm.update({
        where: { id: farm.id },
        data: { coins: farm.coins - price, plots },
      })
      return view(updated)
    }

    if (upgrades.fertilizer >= MAX_FERTILIZER) {
      return reply.code(400).send({ error: 'MAXED', message: 'Adubo já está no nível máximo' })
    }
    const price = fertilizerPrice(upgrades.fertilizer)
    if (farm.coins < price) {
      return reply.code(400).send({ error: 'NO_COINS', message: 'Moedas insuficientes' })
    }
    upgrades.fertilizer++
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins - price, upgrades },
    })
    return view(updated)
  })
}
