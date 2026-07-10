import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  MILHAO_ESCADA,
  MILHAO_NIVEIS,
  MILHAO_PULOS,
  milhaoFichas,
  milhaoPontos,
  milhaoSeErrar,
  milhaoTier,
  type MilhaoResultado,
  type MilhaoUniversitario,
  type MilhaoView,
} from '@mesapop/shared'
import { MILHAO_DIFICIL, MILHAO_FACIL, MILHAO_MEDIO, type MilhaoPergunta } from '../lib/milhaoPerguntas'

/**
 * Tio Mário Milionário — quiz de escada SERVER-AUTORITATIVO: a pergunta
 * atual vive aqui (com a resposta correta) e o cliente só recebe as
 * alternativas embaralhadas. Prêmio, ajudas e pulos são todos decididos
 * no servidor; o Score do ranking é gravado pelo próprio servidor.
 * Sessão em memória por usuário (refresh retoma pela rota /estado).
 */

const SESSOES = new Map<string, Sessao>()
const NOMES_UNIVERSITARIOS = ['Profa. Célia', 'Dr. Ravi', 'Mestre Iara']

interface PerguntaAtiva {
  categoria: string
  texto: string
  alternativas: string[]
  correta: number
}

interface Sessao {
  matchId: string | null
  gameId: string
  nivel: number
  pergunta: PerguntaAtiva
  /** índices já usados por tier, para não repetir na mesma partida */
  usadas: { facil: Set<number>; medio: Set<number>; dificil: Set<number> }
  eliminadas: number[]
  ajudasUsadas: Set<'cartas' | 'universitarios' | 'plateia'>
  pulosRestantes: number
  universitarios: MilhaoUniversitario[] | null
  plateia: number[] | null
  ultima: MilhaoView['ultima']
  fim: { resultado: MilhaoResultado; premio: number; pontosGanhos: number; fichasGanhas: number } | null
}

const BANCOS = { facil: MILHAO_FACIL, medio: MILHAO_MEDIO, dificil: MILHAO_DIFICIL }

function rndInt(n: number): number {
  return crypto.randomInt(0, n)
}

/** sorteia uma pergunta inédita do tier e embaralha as alternativas */
function sorteiaPergunta(s: Pick<Sessao, 'usadas'>, nivel: number): PerguntaAtiva {
  const tier = milhaoTier(nivel)
  const banco = BANCOS[tier]
  const usadas = s.usadas[tier]
  if (usadas.size >= banco.length) usadas.clear() // segurança: banco esgotado
  let i = rndInt(banco.length)
  while (usadas.has(i)) i = (i + 1) % banco.length
  usadas.add(i)
  const p: MilhaoPergunta = banco[i]!
  const ordem = [0, 1, 2, 3]
  for (let k = ordem.length - 1; k > 0; k--) {
    const j = rndInt(k + 1)
    ;[ordem[k], ordem[j]] = [ordem[j]!, ordem[k]!]
  }
  return {
    categoria: p.categoria,
    texto: p.texto,
    alternativas: ordem.map((o) => p.alts[o]!),
    correta: ordem.indexOf(0),
  }
}

function acumuladoDe(nivel: number): number {
  return nivel > 0 ? MILHAO_ESCADA[nivel - 1]! : 0
}

function view(s: Sessao): MilhaoView {
  const acumulado = s.fim ? s.fim.premio : acumuladoDe(s.nivel)
  return {
    fase: s.fim ? 'fim' : 'pergunta',
    nivel: s.nivel,
    valorPergunta: MILHAO_ESCADA[Math.min(s.nivel, MILHAO_NIVEIS - 1)]!,
    acumulado: s.fim ? s.fim.premio : acumulado,
    seErrar: s.fim ? 0 : milhaoSeErrar(s.nivel, acumulado),
    pergunta: s.fim
      ? null
      : { categoria: s.pergunta.categoria, texto: s.pergunta.texto, alternativas: s.pergunta.alternativas },
    eliminadas: s.eliminadas,
    ajudasUsadas: [...s.ajudasUsadas],
    pulosRestantes: s.pulosRestantes,
    universitarios: s.universitarios,
    plateia: s.plateia,
    ultima: s.ultima,
    resultado: s.fim?.resultado ?? null,
    premio: s.fim?.premio ?? 0,
    pontosGanhos: s.fim?.pontosGanhos ?? 0,
    fichasGanhas: s.fim?.fichasGanhas ?? 0,
  }
}

/**
 * Encerra a partida. O ranking é em PONTOS (prêmio/20 — o milhão vale
 * 50.000) e as FICHAS de avatar são proporcionais (prêmio/10.000 — o
 * milhão vale 100): quem para ou erra no meio leva a fração de ambos.
 */
async function encerra(
  app: FastifyInstance,
  userId: string,
  s: Sessao,
  resultado: MilhaoResultado,
  premio: number,
): Promise<void> {
  const pontos = milhaoPontos(premio)
  const fichas = s.matchId ? milhaoFichas(premio) : 0
  s.fim = { resultado, premio, pontosGanhos: s.matchId ? pontos : 0, fichasGanhas: fichas }
  if (!s.matchId) return // convidado: joga, mas não pontua nem ganha fichas
  await app.prisma.match.update({
    where: { id: s.matchId },
    data: { status: 'FINISHED', endedAt: new Date() },
  })
  await app.prisma.matchPlayer.updateMany({
    where: { matchId: s.matchId, userId },
    data: { score: pontos, isWinner: resultado === 'milhao' },
  })
  await app.prisma.score.create({
    data: { userId, gameId: s.gameId, points: pontos, metadata: { resultado, nivel: s.nivel, premio } },
  })
  if (fichas > 0) {
    await app.prisma.user.update({
      where: { id: userId },
      data: { fichas: { increment: fichas } },
    })
  }
}

export default async function milhaoRoutes(app: FastifyInstance) {
  app.post('/api/milhao/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.auth!.sub
    const game = await app.prisma.game.findUnique({ where: { slug: 'tio-mario-milionario' } })
    if (!game || !game.isEnabled) {
      return reply.code(400).send({ error: 'INVALID_GAME', message: 'Jogo indisponível' })
    }

    let matchId: string | null = null
    if (!req.auth!.guest) {
      // partidas anteriores penduradas viram ABANDONED (padrão do solo)
      await app.prisma.match.updateMany({
        where: { gameId: game.id, status: 'IN_PROGRESS', roomId: null, players: { some: { userId } } },
        data: { status: 'ABANDONED', endedAt: new Date() },
      })
      const match = await app.prisma.match.create({ data: { gameId: game.id, players: { create: { userId } } } })
      matchId = match.id
    }

    const s: Sessao = {
      matchId,
      gameId: game.id,
      nivel: 0,
      pergunta: null as unknown as PerguntaAtiva,
      usadas: { facil: new Set(), medio: new Set(), dificil: new Set() },
      eliminadas: [],
      ajudasUsadas: new Set(),
      pulosRestantes: MILHAO_PULOS,
      universitarios: null,
      plateia: null,
      ultima: null,
      fim: null,
    }
    s.pergunta = sorteiaPergunta(s, 0)
    SESSOES.set(userId, s)
    return reply.code(201).send(view(s))
  })

  /** retomada (refresh/reconexão): devolve a MESMA pergunta */
  app.get('/api/milhao/estado', { preHandler: [app.authenticate] }, async (req, reply) => {
    const s = SESSOES.get(req.auth!.sub)
    if (!s) return reply.code(404).send({ error: 'NO_GAME', message: 'Nenhuma partida em andamento' })
    return view(s)
  })

  app.post('/api/milhao/responder', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { escolha } = z.object({ escolha: z.number().int().min(0).max(3) }).parse(req.body)
    const userId = req.auth!.sub
    const s = SESSOES.get(userId)
    if (!s || s.fim) return reply.code(400).send({ error: 'NO_GAME', message: 'Nenhuma pergunta em jogo' })
    if (s.eliminadas.includes(escolha)) {
      return reply.code(400).send({ error: 'ELIMINADA', message: 'Essa alternativa foi eliminada pelas cartas' })
    }

    const certo = escolha === s.pergunta.correta
    s.ultima = { escolha, correta: s.pergunta.correta, certo }

    if (!certo) {
      await encerra(app, userId, s, 'errou', milhaoSeErrar(s.nivel, acumuladoDe(s.nivel)))
      return view(s)
    }

    if (s.nivel >= MILHAO_NIVEIS - 1) {
      // acertou a pergunta do MILHÃO!
      await encerra(app, userId, s, 'milhao', MILHAO_ESCADA[MILHAO_NIVEIS - 1]!)
      return view(s)
    }

    // sobe um degrau: nova pergunta, ajudas de pergunta zeradas
    s.nivel++
    s.pergunta = sorteiaPergunta(s, s.nivel)
    s.eliminadas = []
    s.universitarios = null
    s.plateia = null
    return view(s)
  })

  app.post('/api/milhao/parar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.auth!.sub
    const s = SESSOES.get(userId)
    if (!s || s.fim) return reply.code(400).send({ error: 'NO_GAME', message: 'Nenhuma partida em andamento' })
    s.ultima = null
    await encerra(app, userId, s, 'parou', acumuladoDe(s.nivel))
    return view(s)
  })

  app.post('/api/milhao/ajuda', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { tipo } = z.object({ tipo: z.enum(['cartas', 'universitarios', 'plateia', 'pulo']) }).parse(req.body)
    const userId = req.auth!.sub
    const s = SESSOES.get(userId)
    if (!s || s.fim) return reply.code(400).send({ error: 'NO_GAME', message: 'Nenhuma partida em andamento' })

    const erradas = [0, 1, 2, 3].filter((i) => i !== s.pergunta.correta && !s.eliminadas.includes(i))
    const tier = milhaoTier(s.nivel)

    if (tipo === 'pulo') {
      if (s.pulosRestantes <= 0) return reply.code(400).send({ error: 'SEM_PULOS', message: 'Seus pulos acabaram' })
      s.pulosRestantes--
      s.pergunta = sorteiaPergunta(s, s.nivel)
      s.eliminadas = []
      s.universitarios = null
      s.plateia = null
      s.ultima = null
      return view(s)
    }

    if (s.ajudasUsadas.has(tipo)) {
      return reply.code(400).send({ error: 'AJUDA_USADA', message: 'Essa ajuda já foi usada nesta partida' })
    }
    s.ajudasUsadas.add(tipo)

    if (tipo === 'cartas') {
      // sorteia uma "carta": elimina 1, 2 ou 3 alternativas ERRADAS
      const quantas = 1 + rndInt(3)
      for (let k = 0; k < quantas && erradas.length > 0; k++) {
        const [tirada] = erradas.splice(rndInt(erradas.length), 1)
        s.eliminadas.push(tirada!)
      }
      return view(s)
    }

    // taxa de acerto simulada das ajudas cai com a dificuldade
    const chance = tier === 'facil' ? 0.85 : tier === 'medio' ? 0.68 : 0.52
    const vivas = [0, 1, 2, 3].filter((i) => !s.eliminadas.includes(i))

    if (tipo === 'universitarios') {
      s.universitarios = NOMES_UNIVERSITARIOS.map((nome) => {
        const acerta = rndInt(100) < chance * 100
        const palpite = acerta
          ? s.pergunta.correta
          : (erradas.length ? erradas[rndInt(erradas.length)]! : s.pergunta.correta)
        return { nome, palpite, confianca: 55 + rndInt(41) }
      })
      return view(s)
    }

    // plateia: distribuição percentual pendendo para a correta
    const pesos = vivas.map((i) => (i === s.pergunta.correta ? chance * 100 : rndInt(30) + 5))
    const soma = pesos.reduce((a, b) => a + b, 0)
    const pct = Array(4).fill(0) as number[]
    vivas.forEach((i, k) => {
      pct[i] = Math.round((pesos[k]! / soma) * 100)
    })
    const dif = 100 - pct.reduce((a, b) => a + b, 0)
    pct[s.pergunta.correta] = (pct[s.pergunta.correta] ?? 0) + dif
    s.plateia = pct
    return view(s)
  })
}
