/**
 * Jogo da Memória — os valores das cartas viradas para baixo vivem SÓ
 * aqui no servidor: a visão que trafega revela apenas cartas viradas ou
 * presas. Achou o par, joga de novo; mais pares vence.
 */
import crypto from 'node:crypto'
import {
  MEMORIA_COLS,
  MEMORIA_ROWS,
  type MemoriaAction,
  type MemoriaView,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface MemoriaState {
  players: number
  /** SEGREDO: valor (índice do ícone) de cada posição */
  valores: number[]
  /** posição capturada por quem (-1 = ainda na mesa) */
  donos: number[]
  /** posições viradas na jogada atual (0..2) */
  viradas: number[]
  turno: number
  pares: number[]
  ultimaJogada: MemoriaView['ultimaJogada']
  fim: boolean
  vencedores: number[]
}

export function initialMemoriaState(players: number): MemoriaState {
  const total = MEMORIA_COLS * MEMORIA_ROWS
  const valores: number[] = []
  for (let v = 0; v < total / 2; v++) valores.push(v, v)
  for (let i = valores.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[valores[i], valores[j]] = [valores[j]!, valores[i]!]
  }
  return {
    players,
    valores,
    donos: Array.from({ length: total }, () => -1),
    viradas: [],
    turno: 0,
    pares: Array.from({ length: players }, () => 0),
    ultimaJogada: null,
    fim: false,
    vencedores: [],
  }
}

export function aplicaMemoriaAction(
  s: MemoriaState,
  seat: number,
  action: MemoriaAction,
): { error: string } | { state: MemoriaState } {
  if (s.fim) return { error: 'A partida já terminou' }
  if (s.turno !== seat) return { error: 'Não é a sua vez' }
  const i = action.index
  if (!Number.isInteger(i) || i < 0 || i >= s.valores.length) return { error: 'Carta inválida' }
  if (s.donos[i] !== -1) return { error: 'Esse par já foi capturado' }
  if (s.viradas.includes(i)) return { error: 'Essa carta já está virada' }

  if (s.viradas.length === 0) {
    s.viradas = [i]
    s.ultimaJogada = null
    return { state: s }
  }

  // segunda carta da jogada
  const a = s.viradas[0]!
  const acertou = s.valores[a] === s.valores[i]
  s.ultimaJogada = { a, b: i, va: s.valores[a]!, vb: s.valores[i]!, acertou }
  s.viradas = []
  if (acertou) {
    s.donos[a] = seat
    s.donos[i] = seat
    s.pares[seat]!++
    // achou o par: joga de novo (turno não muda)
    if (s.donos.every((d) => d !== -1)) {
      s.fim = true
      const max = Math.max(...s.pares)
      s.vencedores = s.pares.map((p, idx) => (p === max ? idx : -1)).filter((x) => x >= 0)
    }
  } else {
    s.turno = (s.turno + 1) % s.players
  }
  return { state: s }
}

/** a visão NÃO contém os valores das cartas ocultas */
export function memoriaViewFor(s: MemoriaState): MemoriaView {
  return {
    players: s.players,
    cartas: s.valores.map((v, i) => {
      if (s.donos[i] !== -1) return { estado: 'presa' as const, valor: v, dono: s.donos[i]! }
      if (s.viradas.includes(i)) return { estado: 'virada' as const, valor: v }
      return { estado: 'oculta' as const }
    }),
    turno: s.turno,
    pares: s.pares,
    ultimaJogada: s.ultimaJogada,
    fim: s.fim,
    vencedores: s.vencedores,
  }
}

export const memoriaModule: GameModule<MemoriaState, MemoriaAction> = {
  slug: 'memoria',
  minPlayers: 2,
  maxPlayers: 4,
  allowSpectators: true,
  rotation: true,

  init(playerCount) {
    return initialMemoriaState(playerCount)
  },

  play(state, seat, action) {
    if (!action || action.type !== 'virar') return { error: 'Jogada inválida' }
    return aplicaMemoriaAction(state, seat, action)
  },

  // o segredo é o tabuleiro: espectador e jogador recebem a MESMA visão filtrada
  getStateFor(state) {
    return memoriaViewFor(state)
  },

  result(state) {
    return {
      finished: state.fim,
      winnerSeats: state.vencedores,
      draw: state.fim && state.vencedores.length === state.players,
    }
  },
}
