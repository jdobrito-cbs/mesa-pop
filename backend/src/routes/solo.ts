import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

/**
 * Partidas single-player com leaderboard VALIDADO no servidor.
 *
 * Anti-trapaça (pragmático): o cliente abre a partida no servidor ANTES de
 * jogar (start) e só então envia o resultado (finish). O servidor mede a
 * duração por conta própria e aplica um teto de pontos-por-segundo por
 * jogo — pontuações impossíveis são recusadas.
 */

const PLAUSIBILITY: Record<string, { maxPerSec: number; minMs: number; maxPoints: number }> = {
  'esquadrao-1942': { maxPerSec: 400, minMs: 4000, maxPoints: 2_000_000 },
  'nave-espacial': { maxPerSec: 15, minMs: 3000, maxPoints: 200_000 },
  cardume: { maxPerSec: 80, minMs: 5000, maxPoints: 500_000 },
  snake: { maxPerSec: 30, minMs: 2000, maxPoints: 50_000 },
  'campo-minado': { maxPerSec: 150, minMs: 2500, maxPoints: 2_000 },
  invasores: { maxPerSec: 80, minMs: 4000, maxPoints: 1_000_000 },
  'come-come': { maxPerSec: 120, minMs: 4000, maxPoints: 500_000 },
  'pega-ladrao': { maxPerSec: 100, minMs: 4000, maxPoints: 300_000 },
  'missao-elevador': { maxPerSec: 120, minMs: 5000, maxPoints: 500_000 },
}

const startBody = z.object({ gameSlug: z.string().trim().min(1) })
const finishBody = z.object({
  matchId: z.string().trim().min(1),
  points: z.number().int().min(0),
})

export default async function soloRoutes(app: FastifyInstance) {
  app.post('/api/solo/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    // convidado joga, mas não pontua no ranking — conta obrigatória
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para pontuar no ranking' })
    }
    const { gameSlug } = startBody.parse(req.body)
    const userId = req.auth!.sub

    const game = await app.prisma.game.findUnique({ where: { slug: gameSlug } })
    if (!game || !game.isEnabled || game.maxPlayers !== 1 || !PLAUSIBILITY[gameSlug]) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo indisponível' })
    }

    // partidas solo abandonadas do mesmo jogo são encerradas
    await app.prisma.match.updateMany({
      where: {
        gameId: game.id,
        status: 'IN_PROGRESS',
        roomId: null,
        players: { some: { userId } },
      },
      data: { status: 'ABANDONED', endedAt: new Date() },
    })

    const match = await app.prisma.match.create({
      data: {
        gameId: game.id,
        players: { create: { userId } },
      },
    })
    return reply.code(201).send({ matchId: match.id })
  })

  app.post('/api/solo/finish', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para pontuar no ranking' })
    }
    const { matchId, points } = finishBody.parse(req.body)
    const userId = req.auth!.sub

    const match = await app.prisma.match.findUnique({
      where: { id: matchId },
      include: { game: true, players: true },
    })
    if (
      !match ||
      match.status !== 'IN_PROGRESS' ||
      match.roomId !== null ||
      !match.players.some((p) => p.userId === userId)
    ) {
      return reply.code(400).send({ error: 'INVALID_MATCH', message: 'Partida inválida' })
    }

    const rules = PLAUSIBILITY[match.game.slug]
    if (!rules) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo indisponível' })
    }

    // o SERVIDOR mede a duração — pontuação impossível é recusada
    const elapsedMs = Date.now() - match.startedAt.getTime()
    const cap = Math.min((elapsedMs / 1000) * rules.maxPerSec, rules.maxPoints)
    if (elapsedMs < rules.minMs || points > cap) {
      await app.prisma.match.update({
        where: { id: matchId },
        data: { status: 'ABANDONED', endedAt: new Date() },
      })
      return reply.code(422).send({
        error: 'IMPLAUSIBLE_SCORE',
        message: 'Pontuação rejeitada pela validação do servidor',
      })
    }

    await app.prisma.match.update({
      where: { id: matchId },
      data: { status: 'FINISHED', endedAt: new Date() },
    })
    await app.prisma.matchPlayer.updateMany({
      where: { matchId, userId },
      data: { score: points },
    })
    await app.prisma.score.create({
      data: {
        userId,
        gameId: match.gameId,
        points,
        metadata: { durationMs: elapsedMs },
      },
    })

    // melhor pessoal + posição no ranking (melhor pontuação por usuário)
    const best = await app.prisma.score.aggregate({
      where: { userId, gameId: match.gameId },
      _max: { points: true },
    })
    const bests = await app.prisma.score.groupBy({
      by: ['userId'],
      where: { gameId: match.gameId },
      _max: { points: true },
    })
    const myBest = best._max.points ?? points
    const rank = bests.filter((b) => (b._max.points ?? 0) > myBest).length + 1

    return { points, best: myBest, rank, isRecord: points >= myBest }
  })

  app.get('/api/leaderboards/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const q = z
      .object({ days: z.coerce.number().int().min(1).max(365).default(30) })
      .parse(req.query)

    const game = await app.prisma.game.findUnique({ where: { slug } })
    if (!game) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Jogo não encontrado' })

    const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000)
    const bests = await app.prisma.score.groupBy({
      by: ['userId'],
      where: { gameId: game.id, createdAt: { gte: since } },
      _max: { points: true },
    })
    bests.sort((a, b) => (b._max.points ?? 0) - (a._max.points ?? 0))
    // convidados nunca entram no ranking
    const rankedUsers = await app.prisma.user.findMany({
      where: { id: { in: bests.map((b) => b.userId) }, isGuest: false },
      select: { id: true, displayName: true, username: true },
    })
    const nameOf = new Map(rankedUsers.map((u) => [u.id, u.username ?? u.displayName]))
    const top = bests.filter((b) => nameOf.has(b.userId)).slice(0, 20)

    return {
      days: q.days,
      rows: top.map((b, i) => ({
        rank: i + 1,
        userId: b.userId,
        displayName: nameOf.get(b.userId) ?? '—',
        points: b._max.points ?? 0,
      })),
    }
  })
}
