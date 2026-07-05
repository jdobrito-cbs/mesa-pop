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

export interface AnimalDef {
  kind: string
  name: string
  icon: string
  cost: number
  /** produto coletável em ciclo (ovos/leite) — null para o porco */
  produce: { name: string; icon: string; sell: number; everySecs: number } | null
  /** abate: carne liberada após a maturidade */
  meat: { name: string; sell: number; matureSecs: number }
}

export const ANIMALS: AnimalDef[] = [
  {
    kind: 'galinha',
    name: 'Galinha',
    icon: '🐔',
    cost: 40,
    produce: { name: 'Ovo', icon: '🥚', sell: 8, everySecs: 3 * 60 },
    meat: { name: 'Carne de galinha', sell: 55, matureSecs: 10 * 60 },
  },
  {
    kind: 'porco',
    name: 'Porco',
    icon: '🐖',
    cost: 90,
    produce: null,
    meat: { name: 'Carne de porco', sell: 220, matureSecs: 30 * 60 },
  },
  {
    kind: 'vaca',
    name: 'Vaca',
    icon: '🐄',
    cost: 250,
    produce: { name: 'Leite', icon: '🥛', sell: 30, everySecs: 10 * 60 },
    meat: { name: 'Carne de vaca', sell: 600, matureSecs: 60 * 60 },
  },
]

const START_PLOTS = 4
const MAX_PLOTS = 12
const MAX_FERTILIZER = 5
const MAX_ANIMALS = 8

export const plotPrice = (owned: number) => Math.round(90 * Math.pow(1.65, owned - START_PLOTS))
export const fertilizerPrice = (level: number) => 180 * Math.pow(2, level)
/** adubo: -8% de tempo por nível */
export const growthFactor = (fertilizer: number) => Math.pow(0.92, fertilizer)

interface Plot {
  id: number
  crop: string | null
  plantedAt: string | null
}

interface Animal {
  id: number
  kind: string
  boughtAt: string
  lastCollectedAt: string
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

  function view(farm: { coins: number; plots: unknown; upgrades: unknown; animals: unknown }) {
    const now = Date.now()
    const plots = farm.plots as Plot[]
    const upgrades = farm.upgrades as Upgrades
    const animals = (farm.animals ?? []) as Animal[]
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
      animals: animals.map((a) => {
        const def = ANIMALS.find((d) => d.kind === a.kind)!
        const bought = new Date(a.boughtAt).getTime()
        const last = new Date(a.lastCollectedAt).getTime()
        const produceReadyAt = def.produce ? last + def.produce.everySecs * 1000 : null
        const matureAt = bought + def.meat.matureSecs * 1000
        return {
          id: a.id,
          kind: def.kind,
          name: def.name,
          icon: def.icon,
          produce: def.produce
            ? {
                name: def.produce.name,
                icon: def.produce.icon,
                sell: def.produce.sell,
                readyAt: new Date(produceReadyAt!).toISOString(),
                isReady: now >= produceReadyAt!,
              }
            : null,
          meat: {
            name: def.meat.name,
            sell: def.meat.sell,
            matureAt: new Date(matureAt).toISOString(),
            isMature: now >= matureAt,
          },
        }
      }),
      barn: {
        max: MAX_ANIMALS,
        owned: animals.length,
        forSale: ANIMALS.map((d) => ({
          kind: d.kind,
          name: d.name,
          icon: d.icon,
          cost: d.cost,
          produce: d.produce
            ? { name: d.produce.name, icon: d.produce.icon, sell: d.produce.sell, everySecs: d.produce.everySecs }
            : null,
          meat: d.meat,
        })),
      },
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

  app.post('/api/farm/animal/buy', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { kind } = z.object({ kind: z.string() }).parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const animals = (farm.animals ?? []) as Animal[]
    const def = ANIMALS.find((d) => d.kind === kind)
    if (!def) return reply.code(400).send({ error: 'NO_ANIMAL', message: 'Animal desconhecido' })
    if (animals.length >= MAX_ANIMALS) {
      return reply.code(400).send({ error: 'BARN_FULL', message: 'O curral está cheio' })
    }
    if (farm.coins < def.cost) {
      return reply.code(400).send({ error: 'NO_COINS', message: 'Moedas insuficientes' })
    }
    const nowIso = new Date().toISOString()
    animals.push({
      id: animals.length ? Math.max(...animals.map((a) => a.id)) + 1 : 0,
      kind: def.kind,
      boughtAt: nowIso,
      lastCollectedAt: nowIso,
    })
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins - def.cost, animals },
    })
    return view(updated)
  })

  app.post('/api/farm/animal/collect', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { animalId } = z.object({ animalId: z.number().int().min(0) }).parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const animals = (farm.animals ?? []) as Animal[]
    const animal = animals.find((a) => a.id === animalId)
    if (!animal) return reply.code(400).send({ error: 'NO_ANIMAL', message: 'Animal não encontrado' })
    const def = ANIMALS.find((d) => d.kind === animal.kind)!
    if (!def.produce) {
      return reply.code(400).send({ error: 'NO_PRODUCE', message: 'Este animal não produz nada — é para carne!' })
    }
    const readyAt = new Date(animal.lastCollectedAt).getTime() + def.produce.everySecs * 1000
    // o SERVIDOR decide se o ovo/leite está pronto
    if (Date.now() < readyAt) {
      return reply.code(400).send({ error: 'NOT_READY', message: `${def.produce.name} ainda não está pronto!` })
    }
    animal.lastCollectedAt = new Date().toISOString()
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins + def.produce.sell, animals },
    })
    return { ...view(updated), collected: { name: def.produce.name, icon: def.produce.icon, sell: def.produce.sell } }
  })

  app.post('/api/farm/animal/slaughter', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { animalId } = z.object({ animalId: z.number().int().min(0) }).parse(req.body)
    const farm = await loadFarm(req.auth!.sub)
    const animals = (farm.animals ?? []) as Animal[]
    const animal = animals.find((a) => a.id === animalId)
    if (!animal) return reply.code(400).send({ error: 'NO_ANIMAL', message: 'Animal não encontrado' })
    const def = ANIMALS.find((d) => d.kind === animal.kind)!
    const matureAt = new Date(animal.boughtAt).getTime() + def.meat.matureSecs * 1000
    // abate só depois da maturidade — relógio do servidor
    if (Date.now() < matureAt) {
      return reply.code(400).send({ error: 'NOT_MATURE', message: `${def.name} ainda não está no ponto de abate` })
    }
    const remaining = animals.filter((a) => a.id !== animalId)
    const updated = await app.prisma.farm.update({
      where: { id: farm.id },
      data: { coins: farm.coins + def.meat.sell, animals: remaining },
    })
    return { ...view(updated), slaughtered: { name: def.meat.name, sell: def.meat.sell, icon: '🍖' } }
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
