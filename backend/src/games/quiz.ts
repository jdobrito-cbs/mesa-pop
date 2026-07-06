/**
 * Engine de trivia — UMA implementação, DOIS jogos (Quiz Pop e Quiz
 * Nostalgia) via makeQuizModule(slug, banco). O servidor sorteia as
 * perguntas, embaralha as alternativas, cronometra e SÓ revela a certa
 * na fase de revelação. Pontos: 100 + bônus de rapidez (até 50).
 */
import crypto from 'node:crypto'
import {
  QUIZ_BONUS_RAPIDEZ,
  QUIZ_PONTOS_BASE,
  QUIZ_RODADAS,
  QUIZ_TEMPO_PERGUNTA,
  QUIZ_TEMPO_REVELACAO,
  type QuizAction,
  type QuizFase,
  type QuizView,
} from '@mesapop/shared'
import type { QuizPergunta } from '../lib/quizPerguntas'
import type { GameModule } from './module'

interface PerguntaPreparada {
  c: string
  p: string
  ops: string[]
  correta: number // índice em ops — SEGREDO até a revelação
}

export interface QuizState {
  players: number
  fase: QuizFase
  rodada: number
  perguntas: PerguntaPreparada[]
  tempo: number
  respostas: Array<number | null>
  /** tempo restante no momento da resposta (para o bônus) */
  registro: number[]
  ganhoUltima: number[]
  placar: number[]
  vencedores: number[]
}

function embaralhaCrypto<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

export function initialQuizState(players: number, banco: QuizPergunta[]): QuizState {
  const sorteadas = embaralhaCrypto([...banco]).slice(0, Math.min(QUIZ_RODADAS, banco.length))
  const perguntas = sorteadas.map((q) => {
    const ops = embaralhaCrypto([...q.alts])
    return { c: q.c, p: q.p, ops, correta: ops.indexOf(q.alts[0]) }
  })
  return {
    players,
    fase: 'pergunta',
    rodada: 0,
    perguntas,
    tempo: QUIZ_TEMPO_PERGUNTA,
    respostas: Array.from({ length: players }, () => null),
    registro: Array.from({ length: players }, () => 0),
    ganhoUltima: Array.from({ length: players }, () => 0),
    placar: Array.from({ length: players }, () => 0),
    vencedores: [],
  }
}

function revela(s: QuizState) {
  const pergunta = s.perguntas[s.rodada]!
  s.ganhoUltima = s.respostas.map((resp, seat) => {
    if (resp !== pergunta.correta) return 0
    const bonus = Math.round((QUIZ_BONUS_RAPIDEZ * s.registro[seat]!) / QUIZ_TEMPO_PERGUNTA)
    return QUIZ_PONTOS_BASE + bonus
  })
  s.ganhoUltima.forEach((g, seat) => (s.placar[seat]! += g))
  s.fase = 'revelacao'
  s.tempo = QUIZ_TEMPO_REVELACAO
}

function proxima(s: QuizState) {
  s.rodada++
  if (s.rodada >= s.perguntas.length) {
    s.fase = 'fim'
    const max = Math.max(...s.placar)
    s.vencedores = s.placar.map((p, i) => (p === max ? i : -1)).filter((i) => i >= 0)
    return
  }
  s.fase = 'pergunta'
  s.tempo = QUIZ_TEMPO_PERGUNTA
  s.respostas = s.respostas.map(() => null)
  s.registro = s.registro.map(() => 0)
}

export function tickQuiz(s: QuizState, dt: number) {
  if (s.fase === 'fim') return
  s.tempo -= dt
  if (s.fase === 'pergunta') {
    const todos = s.respostas.every((r) => r !== null)
    if (todos || s.tempo <= 0) revela(s)
  } else if (s.fase === 'revelacao' && s.tempo <= 0) {
    proxima(s)
  }
}

export function aplicaQuizAction(
  s: QuizState,
  seat: number,
  action: QuizAction,
): { error: string } | { state: QuizState } {
  if (s.fase !== 'pergunta') return { error: 'Espere a próxima pergunta' }
  if (seat < 0 || seat >= s.players) return { error: 'Espectador só torce! 📣' }
  if (s.respostas[seat] !== null) return { error: 'Resposta já travada!' }
  const pergunta = s.perguntas[s.rodada]!
  const i = action.index
  if (!Number.isInteger(i) || i < 0 || i >= pergunta.ops.length) return { error: 'Alternativa inválida' }
  s.respostas[seat] = i
  s.registro[seat] = Math.max(0, s.tempo)
  return { state: s }
}

export function quizViewFor(s: QuizState, seat: number): QuizView {
  const pergunta = s.perguntas[Math.min(s.rodada, s.perguntas.length - 1)]!
  const revelando = s.fase !== 'pergunta'
  return {
    fase: s.fase,
    players: s.players,
    rodada: Math.min(s.rodada, s.perguntas.length - 1),
    totalRodadas: s.perguntas.length,
    categoria: pergunta.c,
    pergunta: pergunta.p,
    alternativas: pergunta.ops,
    tempoRestante: Math.max(0, s.tempo),
    minhaResposta: seat >= 0 && seat < s.players ? s.respostas[seat]! : null,
    responderam: s.respostas.map((r) => r !== null),
    correta: revelando ? pergunta.correta : null,
    respostas: revelando ? s.respostas : null,
    ganhoUltima: s.ganhoUltima,
    placar: s.placar,
    vencedores: s.vencedores,
  }
}

export function makeQuizModule(slug: string, banco: QuizPergunta[]): GameModule<QuizState, QuizAction> {
  return {
    slug,
    minPlayers: 2,
    maxPlayers: 8,
    allowSpectators: true,
    realtime: { tickMs: 250, broadcastEvery: 2, perSeatView: true },

    init(playerCount) {
      return initialQuizState(playerCount, banco)
    },

    tick(state, dt) {
      tickQuiz(state, dt)
    },

    play(state, seat, action) {
      if (!action || action.type !== 'resposta') return { error: 'Jogada inválida' }
      return aplicaQuizAction(state, seat, action)
    },

    // a CORRETA e as respostas alheias só aparecem na revelação
    getStateFor(state, seat) {
      return quizViewFor(state, seat)
    },

    scoresFor(state) {
      return state.placar
    },

    result(state) {
      return {
        finished: state.fase === 'fim',
        winnerSeats: state.vencedores,
        draw: state.fase === 'fim' && state.vencedores.length === state.players,
      }
    },
  }
}
