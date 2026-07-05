/**
 * Stop! — servidor autoritativo: guarda as respostas de todos SEM
 * mostrar aos rivais até o STOP; valida a letra inicial e pontua
 * 10 (única) / 5 (repetida) / 0 (inválida ou vazia).
 * Validação de dicionário ("é mesmo um animal?") é melhoria futura —
 * candidata: votação entre jogadores.
 */
import {
  normalizaResposta,
  STOP_CATEGORIAS,
  STOP_RODADAS,
  STOP_TEMPO_RESULTADO,
  STOP_TEMPO_RODADA,
  type StopFase,
  type StopResultadoLinha,
  type StopView,
} from '@mesapop/shared'
import type { GameModule } from './module'

const LETRAS = [...'ABCDEFGHIJLMNOPRSTV']
const N = STOP_CATEGORIAS.length

export interface StopState {
  players: number
  fase: StopFase
  rodada: number
  letra: string
  letrasUsadas: string[]
  tempo: number
  respostas: string[][] // [seat][categoria]
  stopPor: number | null
  resultado: StopResultadoLinha[] | null
  scores: number[]
  vencedores: number[]
}

type StopAction = { type: 'respostas'; valores: string[] } | { type: 'stop' }

function sorteiaLetra(usadas: string[]): string {
  const livres = LETRAS.filter((l) => !usadas.includes(l))
  return livres[Math.floor(Math.random() * livres.length)] ?? LETRAS[0]!
}

export function initialStopState(players: number): StopState {
  const letra = sorteiaLetra([])
  return {
    players,
    fase: 'preenchendo',
    rodada: 1,
    letra,
    letrasUsadas: [letra],
    tempo: STOP_TEMPO_RODADA,
    respostas: Array.from({ length: players }, () => Array.from({ length: N }, () => '')),
    stopPor: null,
    resultado: null,
    scores: Array.from({ length: players }, () => 0),
    vencedores: [],
  }
}

function completou(s: StopState, seat: number): boolean {
  return s.respostas[seat]!.every((r) => normalizaResposta(r).length > 0)
}

/** fecha a rodada: compara, valida a letra e pontua */
function fechaRodada(s: StopState, quem: number | null) {
  s.fase = 'resultado'
  s.tempo = STOP_TEMPO_RESULTADO
  s.stopPor = quem

  const letra = s.letra.toLowerCase()
  const normalizadas = s.respostas.map((linha) => linha.map(normalizaResposta))

  s.resultado = s.respostas.map((linha, seat) => {
    const pontos: number[] = linha.map((_, cat) => {
      const resp = normalizadas[seat]![cat]!
      if (!resp || !resp.startsWith(letra)) return 0
      const repetida = normalizadas.some((outra, o) => o !== seat && outra[cat] === resp)
      return repetida ? 5 : 10
    })
    const total = pontos.reduce((a, b) => a + b, 0)
    s.scores[seat] = (s.scores[seat] ?? 0) + total
    return { seat, respostas: linha, pontos, total }
  })
}

function proximaRodada(s: StopState) {
  if (s.rodada >= STOP_RODADAS) {
    s.fase = 'fim'
    const max = Math.max(...s.scores)
    s.vencedores = s.scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0)
    return
  }
  s.rodada++
  s.letra = sorteiaLetra(s.letrasUsadas)
  s.letrasUsadas.push(s.letra)
  s.fase = 'preenchendo'
  s.tempo = STOP_TEMPO_RODADA
  s.respostas = s.respostas.map(() => Array.from({ length: N }, () => ''))
  s.stopPor = null
  s.resultado = null
}

export function aplicaStopAction(
  s: StopState,
  seat: number,
  action: StopAction,
): { error: string } | { state: StopState } {
  if (s.fase === 'fim') return { error: 'A partida já terminou' }

  if (action.type === 'respostas') {
    if (s.fase !== 'preenchendo') return { error: 'A rodada já fechou' }
    if (!Array.isArray(action.valores)) return { error: 'Respostas inválidas' }
    s.respostas[seat] = Array.from({ length: N }, (_, i) => String(action.valores[i] ?? '').slice(0, 30))
    return { state: s }
  }

  if (action.type === 'stop') {
    if (s.fase !== 'preenchendo') return { error: 'A rodada já fechou' }
    if (!completou(s, seat)) return { error: 'Preencha TODAS as categorias para gritar STOP!' }
    fechaRodada(s, seat)
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

export function tickStop(s: StopState, dt: number) {
  if (s.fase === 'fim') return
  s.tempo -= dt
  if (s.tempo > 0) return
  if (s.fase === 'preenchendo') fechaRodada(s, null)
  else if (s.fase === 'resultado') proximaRodada(s)
}

export function stopViewFor(s: StopState, seat: number): StopView {
  return {
    fase: s.fase,
    rodada: s.rodada,
    totalRodadas: STOP_RODADAS,
    letra: s.letra,
    tempo: Math.max(Math.ceil(s.tempo), 0),
    minhas: seat >= 0 ? (s.respostas[seat] ?? []) : Array.from({ length: N }, () => ''),
    // rivais: só o PROGRESSO (nunca os textos) enquanto preenchem
    progresso: s.respostas.map((linha, i) => ({
      seat: i,
      preenchidas: linha.filter((r) => normalizaResposta(r).length > 0).length,
    })),
    stopPor: s.stopPor,
    resultado: s.fase === 'resultado' || s.fase === 'fim' ? s.resultado : null,
    scores: s.scores,
    vencedores: s.vencedores,
  }
}

export const stopModule: GameModule<StopState, StopAction> = {
  slug: 'stop',
  minPlayers: 2,
  maxPlayers: 6,
  allowSpectators: true,
  realtime: { tickMs: 500, broadcastEvery: 1, perSeatView: true },

  init(playerCount) {
    return initialStopState(playerCount)
  },

  play(state, seat, action) {
    return aplicaStopAction(state, seat, action)
  },

  tick(state, dt) {
    tickStop(state, dt)
  },

  getStateFor(state, seat) {
    return stopViewFor(state, seat)
  },

  scoresFor(state) {
    return state.scores
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedores,
      draw: false,
    }
  },
}
