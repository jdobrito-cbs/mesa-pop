import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { avaliaPalpite, normaliza5, palavraDoDia } from '../lib/palavras5'

/**
 * Palavra do Dia — desafio diário com seed do dia:
 * a MESMA palavra para todo mundo, escolhida e guardada NO SERVIDOR
 * (o cliente só recebe o feedback verde/amarelo/cinza — impossível
 * espiar). Uma partida por usuário por dia; ranking diário próprio.
 */

interface Attempt {
  palpite: string
  feedback: string
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PONTOS_POR_TENTATIVA = [100, 80, 60, 45, 30, 20]

export default async function termoRoutes(app: FastifyInstance) {
  app.get('/api/termo/hoje', { preHandler: [app.authenticate] }, async (req) => {
    const play = await app.prisma.termoPlay.findUnique({
      where: { userId_date: { userId: req.auth!.sub, date: hoje() } },
    })
    const attempts = (play?.attempts ?? []) as unknown as Attempt[]
    return {
      date: hoje(),
      attempts,
      done: play?.done ?? false,
      won: play?.won ?? false,
      points: play?.points ?? 0,
      maxAttempts: 6,
    }
  })

  app.post('/api/termo/palpite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { palavra } = z.object({ palavra: z.string() }).parse(req.body)
    const palpite = normaliza5(palavra)
    if (palpite.length !== 5) {
      return reply.code(400).send({ error: 'INVALID_WORD', message: 'O palpite precisa de 5 letras' })
    }

    const userId = req.auth!.sub
    const date = hoje()
    const existing = await app.prisma.termoPlay.findUnique({ where: { userId_date: { userId, date } } })
    const attempts = (existing?.attempts ?? []) as unknown as Attempt[]
    if (existing?.done) {
      return reply.code(409).send({ error: 'DONE', message: 'Você já jogou hoje — volte amanhã!' })
    }
    if (attempts.length >= 6) {
      return reply.code(409).send({ error: 'DONE', message: 'Tentativas esgotadas por hoje' })
    }

    const alvo = palavraDoDia(new Date())
    const feedback = avaliaPalpite(alvo, palpite)
    attempts.push({ palpite, feedback })
    const won = feedback === 'ggggg'
    const done = won || attempts.length >= 6
    const points = won ? PONTOS_POR_TENTATIVA[attempts.length - 1]! : 0

    await app.prisma.termoPlay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, attempts: attempts as never, done, won, points },
      update: { attempts: attempts as never, done, won, points },
    })

    return {
      feedback,
      done,
      won,
      points,
      // a palavra só é revelada quando o jogo do dia termina SEM vitória
      palavra: done && !won ? alvo : won ? alvo : null,
      attempt: attempts.length,
    }
  })

  /** ranking do dia (contas registradas; convidados jogam mas ficam de fora) */
  app.get('/api/termo/ranking', async () => {
    const rows = await app.prisma.termoPlay.findMany({
      where: { date: hoje(), won: true, user: { isGuest: false } },
      orderBy: [{ points: 'desc' }, { updatedAt: 'asc' }],
      take: 20,
      include: { user: { select: { username: true, displayName: true } } },
    })
    return {
      date: hoje(),
      rows: rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.user.username ?? r.user.displayName,
        points: r.points,
        attempts: ((r.attempts ?? []) as unknown as Attempt[]).length,
      })),
    }
  })
}
