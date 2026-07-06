/**
 * Bingo 75 — o SERVIDOR canta as bolas no ritmo (tick realtime) e é o
 * único juiz: marcar exige que a bola tenha sido sorteada, e o BINGO!
 * é conferido linha a linha. Cartelas geradas com crypto, uma por assento.
 */
import crypto from 'node:crypto'
import {
  BINGO_INTERVALO,
  BINGO_LINHAS,
  type BingoAction,
  type BingoFase,
  type BingoView,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface BingoState {
  players: number
  fase: BingoFase
  saco: number[]
  bolas: number[]
  proximaEm: number
  cartelas: number[][] // 25 por assento; índice 12 = 0 (casa livre)
  marcadas: boolean[][]
  vencedor: number | null
  linhaVencedora: number[] | null
}

function embaralhaCrypto<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** cartela 5×5: coluna k sorteia 5 números de 15k+1..15k+15; centro livre */
function geraCartela(): number[] {
  const cartela: number[] = Array.from({ length: 25 }, () => 0)
  for (let c = 0; c < 5; c++) {
    const faixa = embaralhaCrypto(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5)
    for (let r = 0; r < 5; r++) cartela[r * 5 + c] = faixa[r]!
  }
  cartela[12] = 0 // casa LIVRE
  return cartela
}

export function initialBingoState(players: number): BingoState {
  return {
    players,
    fase: 'sorteando',
    saco: embaralhaCrypto(Array.from({ length: 75 }, (_, i) => i + 1)),
    bolas: [],
    proximaEm: 2.5, // respiro antes da primeira bola
    cartelas: Array.from({ length: players }, () => geraCartela()),
    marcadas: Array.from({ length: players }, () =>
      Array.from({ length: 25 }, (_, i) => i === 12),
    ),
    vencedor: null,
    linhaVencedora: null,
  }
}

export function tickBingo(s: BingoState, dt: number) {
  if (s.fase !== 'sorteando') return
  s.proximaEm -= dt
  if (s.proximaEm <= 0 && s.saco.length > 0) {
    s.bolas.push(s.saco.pop()!)
    s.proximaEm = BINGO_INTERVALO
  }
}

export function aplicaBingoAction(
  s: BingoState,
  seat: number,
  action: BingoAction,
): { error: string } | { state: BingoState } {
  if (s.fase === 'fim') return { error: 'O bingo já acabou' }
  if (seat < 0 || seat >= s.players) return { error: 'Espectador só torce! 📣' }

  if (action.type === 'marcar') {
    const i = action.index
    if (!Number.isInteger(i) || i < 0 || i >= 25) return { error: 'Casa inválida' }
    const numero = s.cartelas[seat]![i]!
    if (numero === 0) return { error: 'Essa casa já é sua' }
    if (s.marcadas[seat]![i]) return { error: 'Já está marcada' }
    if (!s.bolas.includes(numero)) return { error: `O ${numero} ainda não foi cantado!` }
    s.marcadas[seat]![i] = true
    return { state: s }
  }

  if (action.type === 'bingo') {
    const marcas = s.marcadas[seat]!
    const linha = BINGO_LINHAS.find((cells) => cells.every((c) => marcas[c]))
    if (!linha) return { error: 'Ainda não deu bingo — confira a cartela!' }
    s.vencedor = seat
    s.linhaVencedora = linha
    s.fase = 'fim'
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

export function bingoViewFor(s: BingoState, seat: number): BingoView {
  const souJogador = seat >= 0 && seat < s.players
  return {
    fase: s.fase,
    players: s.players,
    bolaAtual: s.bolas[s.bolas.length - 1] ?? null,
    bolas: s.bolas,
    proximaEm: Math.max(0, s.proximaEm),
    minhaCartela: souJogador ? s.cartelas[seat]! : [],
    minhasMarcadas: souJogador ? s.marcadas[seat]! : [],
    rivais: s.marcadas.map((m, i) => ({ seat: i, marcadas: m.filter(Boolean).length })),
    vencedor: s.vencedor,
    linhaVencedora: s.linhaVencedora,
  }
}

export const bingoModule: GameModule<BingoState, BingoAction> = {
  slug: 'bingo',
  minPlayers: 2,
  maxPlayers: 16,
  allowSpectators: true,
  realtime: { tickMs: 500, broadcastEvery: 1, perSeatView: true },

  init(playerCount) {
    return initialBingoState(playerCount)
  },

  tick(state, dt) {
    tickBingo(state, dt)
  },

  play(state, seat, action) {
    if (!action || !['marcar', 'bingo'].includes(action.type)) {
      return { error: 'Jogada inválida' }
    }
    return aplicaBingoAction(state, seat, action)
  },

  getStateFor(state, seat) {
    return bingoViewFor(state, seat)
  },

  scoresFor(state) {
    return state.marcadas.map((m, i) => m.filter(Boolean).length + (state.vencedor === i ? 100 : 0))
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedor !== null ? [state.vencedor] : [],
      draw: false,
    }
  },
}
