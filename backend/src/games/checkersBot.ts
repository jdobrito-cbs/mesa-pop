import {
  applyMove,
  legalMoves,
  type CheckersMove,
  type CheckersState,
  type PlayerIdx,
} from '@mesapop/shared'

/**
 * Bot de Damas — nível equilibrado. Minimax com poda alfa-beta sobre as
 * regras compartilhadas (captura obrigatória já vem embutida em legalMoves).
 * Avaliação: material (peão/dama) + avanço dos peões rumo à promoção.
 */

const INF = 1e9
const DEPTH = 6

/** avaliação do tabuleiro pela ótica do assento do bot */
function evaluate(state: CheckersState, botSeat: PlayerIdx): number {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const pc = state.board[i]
    if (!pc) continue
    let v = pc.k ? 300 : 100
    if (!pc.k) {
      // peão: quanto mais perto da última fileira, melhor (promoção)
      const r = Math.floor(i / 8)
      const dist = pc.p === 0 ? r : 7 - r // fileiras até coroar
      v += (7 - dist) * 4
    }
    score += pc.p === botSeat ? v : -v
  }
  return score
}

function negamax(
  state: CheckersState,
  depth: number,
  alpha: number,
  beta: number,
  botSeat: PlayerIdx,
): number {
  if (state.winner !== null) {
    // vitória do lado que acabou de jogar; +/- ajustado pela profundidade
    return state.winner === botSeat ? INF - (DEPTH - depth) : -INF + (DEPTH - depth)
  }
  if (state.draw) return 0
  if (depth === 0) return evaluate(state, botSeat)

  const moves = legalMoves(state)
  if (moves.length === 0) {
    // sem lances: quem está na vez perde
    return state.turn === botSeat ? -INF + (DEPTH - depth) : INF - (DEPTH - depth)
  }

  const maximizing = state.turn === botSeat
  if (maximizing) {
    let best = -INF
    for (const m of moves) {
      best = Math.max(best, negamax(applyMove(state, m), depth - 1, alpha, beta, botSeat))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = INF
  for (const m of moves) {
    best = Math.min(best, negamax(applyMove(state, m), depth - 1, alpha, beta, botSeat))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

/** escolhe o lance do bot; entre lances quase iguais, sorteia (partidas variadas) */
export function chooseCheckersMove(
  state: CheckersState,
  seat: number,
): { from: number; to: number } | null {
  const moves = legalMoves(state)
  if (moves.length === 0) return null
  if (moves.length === 1) return { from: moves[0]!.from, to: moves[0]!.to }

  const botSeat = seat as PlayerIdx
  // captura mais longa primeiro (ajuda a poda)
  const ordered = [...moves].sort((a, b) => b.captures.length - a.captures.length)

  let bestVal = -INF
  let best: CheckersMove[] = []
  for (const m of ordered) {
    const val = negamax(applyMove(state, m), DEPTH - 1, -INF, INF, botSeat)
    if (val > bestVal + 1) {
      bestVal = val
      best = [m]
    } else if (Math.abs(val - bestVal) <= 1) {
      best.push(m)
    }
  }
  const pick = best[Math.floor(Math.random() * best.length)] ?? ordered[0]!
  return { from: pick.from, to: pick.to }
}
