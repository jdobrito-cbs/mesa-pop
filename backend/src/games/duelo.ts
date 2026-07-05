/**
 * Duelo de Palavras — servidor autoritativo: a palavra fica AQUI; cada
 * palpite volta só com as cores. Rivais recebem grades sem letras.
 */
import {
  DUELO_TEMPO,
  DUELO_TENTATIVAS,
  type DueloTentativa,
  type DueloView,
} from '@mesapop/shared'
import { avaliaPalpite, normaliza5, palavraAleatoria } from '../lib/palavras5'
import type { GameModule } from './module'

export interface DueloState {
  players: number
  fase: 'jogando' | 'fim'
  palavra: string
  tempo: number
  grades: DueloTentativa[][]
  vencedores: number[]
}

type DueloAction = { type: 'palpite'; palavra: string }

export function initialDueloState(players: number): DueloState {
  return {
    players,
    fase: 'jogando',
    palavra: palavraAleatoria(),
    tempo: DUELO_TEMPO,
    grades: Array.from({ length: players }, () => []),
    vencedores: [],
  }
}

function acertou(grade: DueloTentativa[]): boolean {
  return grade.some((t) => t.feedback === 'ggggg')
}

function acabou(grade: DueloTentativa[]): boolean {
  return acertou(grade) || grade.length >= DUELO_TENTATIVAS
}

/** melhor progresso: mais verdes (depois amarelos) no melhor palpite */
function progresso(grade: DueloTentativa[]): number {
  let best = 0
  for (const t of grade) {
    const g = [...t.feedback].filter((c) => c === 'g').length
    const y = [...t.feedback].filter((c) => c === 'y').length
    best = Math.max(best, g * 10 + y)
  }
  return best
}

function encerra(s: DueloState) {
  s.fase = 'fim'
  const quemAcertou = s.grades
    .map((g, seat) => ({ seat, hit: acertou(g), tentativas: g.length }))
    .filter((r) => r.hit)
  if (quemAcertou.length) {
    // menor nº de tentativas vence (empate → todos os empatados)
    const min = Math.min(...quemAcertou.map((r) => r.tentativas))
    s.vencedores = quemAcertou.filter((r) => r.tentativas === min).map((r) => r.seat)
    return
  }
  // ninguém acertou: melhor progresso leva (pode empatar)
  const scores = s.grades.map(progresso)
  const max = Math.max(...scores)
  s.vencedores = max > 0 ? scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0) : []
}

export function aplicaDueloAction(
  s: DueloState,
  seat: number,
  action: DueloAction,
): { error: string } | { state: DueloState } {
  if (s.fase !== 'jogando') return { error: 'O duelo já terminou' }
  if (action.type !== 'palpite') return { error: 'Ação inválida' }
  const grade = s.grades[seat]
  if (!grade) return { error: 'Assento inválido' }
  if (acabou(grade)) return { error: 'Suas tentativas acabaram — aguarde os rivais' }
  const palpite = normaliza5(String(action.palavra ?? ''))
  if (palpite.length !== 5) return { error: 'O palpite precisa de 5 letras' }

  grade.push({ palpite, feedback: avaliaPalpite(s.palavra, palpite) })

  // acertou → vence NA HORA; todos travados → encerra também
  if (acertou(grade) || s.grades.every(acabou)) encerra(s)
  return { state: s }
}

export function tickDuelo(s: DueloState, dt: number) {
  if (s.fase !== 'jogando') return
  s.tempo -= dt
  if (s.tempo <= 0) encerra(s)
}

export function dueloViewFor(s: DueloState, seat: number): DueloView {
  const minha = seat >= 0 ? (s.grades[seat] ?? []) : []
  return {
    fase: s.fase,
    tempo: Math.max(Math.ceil(s.tempo), 0),
    minha,
    acabei: seat >= 0 ? acabou(minha) : true,
    acertei: acertou(minha),
    rivais: s.grades
      .map((g, i) => ({
        seat: i,
        feedbacks: g.map((t) => t.feedback), // SÓ as cores
        acabou: acabou(g),
        acertou: acertou(g),
      }))
      .filter((r) => r.seat !== seat),
    vencedores: s.vencedores,
    palavra: s.fase === 'fim' ? s.palavra : null,
    maxTentativas: DUELO_TENTATIVAS,
  }
}

export const dueloModule: GameModule<DueloState, DueloAction> = {
  slug: 'duelo-palavras',
  minPlayers: 2,
  maxPlayers: 6,
  allowSpectators: true,
  realtime: { tickMs: 250, broadcastEvery: 1, perSeatView: true },

  init(playerCount) {
    return initialDueloState(playerCount)
  },

  play(state, seat, action) {
    return aplicaDueloAction(state, seat, action)
  },

  tick(state, dt) {
    tickDuelo(state, dt)
  },

  getStateFor(state, seat) {
    return dueloViewFor(state, seat)
  },

  scoresFor(state) {
    return state.grades.map((g) => (acertou(g) ? 100 - (g.length - 1) * 10 : progresso(g)))
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedores,
      draw: state.fase === 'fim' && state.vencedores.length === 0,
    }
  },
}
