import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DESAFIO_SLUGS, ehDesafioDiario } from '@mesapop/shared'
import { PLAUSIBILITY } from '../lib/plausibility'

/**
 * Desafio Diário — o MESMO puzzle para todos a cada dia (seed = a data).
 * Uma tentativa por jogo por dia; ranking próprio do dia. O servidor mede
 * a duração a partir de startedAt (anti-trapaça), reaproveitando o teto de
 * pontos do PLAUSIBILITY. Convidado joga o puzzle mas não pontua (as
 * páginas só chamam start/finish quando há conta — como nas partidas livres).
 */

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const slugBody = z.object({ gameSlug: z.string().trim().min(1) })
const finishBody = z.object({
  gameSlug: z.string().trim().min(1),
  points: z.number().int().min(0),
})

export default async function desafioRoutes(app: FastifyInstance) {
  // status do dia: a data (seed) + o que este usuário já fechou hoje
  app.get('/api/desafio/hoje', { preHandler: [app.authenticate] }, async (req) => {
    const date = hoje()
    const plays = await app.prisma.desafioPlay.findMany({
      where: { userId: req.auth!.sub, date, gameSlug: { in: DESAFIO_SLUGS } },
    })
    const byslug = new Map(plays.map((p) => [p.gameSlug, p]))
    return {
      date,
      jogos: DESAFIO_SLUGS.map((slug) => {
        const p = byslug.get(slug)
        return { slug, done: p?.done ?? false, points: p?.points ?? 0 }
      }),
    }
  })

  app.post('/api/desafio/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para pontuar no desafio' })
    }
    const { gameSlug } = slugBody.parse(req.body)
    if (!ehDesafioDiario(gameSlug) || !PLAUSIBILITY[gameSlug]) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo fora do desafio diário' })
    }
    const game = await app.prisma.game.findUnique({ where: { slug: gameSlug } })
    if (!game || !game.isEnabled) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo indisponível' })
    }

    const userId = req.auth!.sub
    const date = hoje()
    const existing = await app.prisma.desafioPlay.findUnique({
      where: { userId_gameSlug_date: { userId, gameSlug, date } },
    })
    if (existing?.done) {
      return reply.code(409).send({ error: 'DONE', message: 'Você já fez o desafio de hoje — volte amanhã!' })
    }

    // (re)inicia o cronômetro do dia — o puzzle é o mesmo (seed = data), então
    // reabrir não dá vantagem; só o primeiro FINISH fecha a tentativa.
    await app.prisma.desafioPlay.upsert({
      where: { userId_gameSlug_date: { userId, gameSlug, date } },
      create: { userId, gameSlug, date, startedAt: new Date(), done: false, points: 0 },
      update: { startedAt: new Date() },
    })
    return reply.code(201).send({ ok: true, date })
  })

  app.post('/api/desafio/finish', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para pontuar no desafio' })
    }
    const { gameSlug, points } = finishBody.parse(req.body)
    const rules = PLAUSIBILITY[gameSlug]
    if (!ehDesafioDiario(gameSlug) || !rules) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo fora do desafio diário' })
    }

    const userId = req.auth!.sub
    const date = hoje()
    const play = await app.prisma.desafioPlay.findUnique({
      where: { userId_gameSlug_date: { userId, gameSlug, date } },
    })
    if (!play) {
      return reply.code(400).send({ error: 'NOT_STARTED', message: 'Comece o desafio antes de enviar o resultado' })
    }
    if (play.done) {
      return reply.code(409).send({ error: 'DONE', message: 'Você já fez o desafio de hoje — volte amanhã!' })
    }

    // o SERVIDOR mede a duração — pontuação impossível é recusada (sem fechar
    // a tentativa, então um envio inválido não queima o desafio do dia)
    const elapsedMs = Date.now() - play.startedAt.getTime()
    const cap = Math.min((elapsedMs / 1000) * rules.maxPerSec, rules.maxPoints)
    if (elapsedMs < rules.minMs || points > cap) {
      return reply.code(422).send({
        error: 'IMPLAUSIBLE_SCORE',
        message: 'Pontuação rejeitada pela validação do servidor',
      })
    }

    await app.prisma.desafioPlay.update({
      where: { userId_gameSlug_date: { userId, gameSlug, date } },
      data: { done: true, points, elapsedMs },
    })

    // posição no ranking do dia (mais pontos; empate → mais rápido)
    const doDia = await app.prisma.desafioPlay.findMany({
      where: { gameSlug, date, done: true, user: { isGuest: false } },
      orderBy: [{ points: 'desc' }, { elapsedMs: 'asc' }],
      select: { userId: true },
    })
    const rank = doDia.findIndex((p) => p.userId === userId) + 1
    return { points, rank: rank || 1, total: doDia.length, date }
  })

  // ranking do dia de um jogo (contas registradas; convidados ficam de fora)
  app.get('/api/desafio/ranking/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    if (!ehDesafioDiario(slug)) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Desafio não encontrado' })
    }
    const date = hoje()
    const rows = await app.prisma.desafioPlay.findMany({
      where: { gameSlug: slug, date, done: true, user: { isGuest: false } },
      orderBy: [{ points: 'desc' }, { elapsedMs: 'asc' }],
      take: 20,
      include: { user: { select: { username: true, displayName: true } } },
    })
    return {
      date,
      slug,
      rows: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        displayName: r.user.username ?? r.user.displayName,
        points: r.points,
        segundos: Math.round(r.elapsedMs / 1000),
      })),
    }
  })
}
