import {
  allLegalChessMoves,
  applyChessRaw,
  colOf,
  inCheck,
  rowOf,
  type ChessMove,
  type ChessState,
  type PieceType,
} from '@mesapop/shared'

/**
 * Bot de Xadrez — nível equilibrado. Negamax com poda alfa-beta (3 plies) e
 * uma busca de quiescência (só capturas) para não deixar peça pendurada.
 * Avaliação: material + controle do centro + avanço dos peões.
 */

const VAL: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const INF = 1e9
const MATE = 100_000
const DEPTH = 3
const QUIESCE_MAX = 4

/** material + posição, pela ótica das BRANCAS (cor 0) */
function evalWhite(s: ChessState): number {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const pc = s.board[i]
    if (!pc) continue
    let v = VAL[pc.t]
    const r = rowOf(i)
    const c = colOf(i)
    // bônus por controle do centro (cai nas bordas)
    v += 10 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) * 1.5
    if (pc.t === 'p') {
      // brancas (cor 0) sobem (linha diminui); pretas descem
      const adv = pc.c === 0 ? 6 - r : r - 1
      v += adv * 6
    }
    score += pc.c === 0 ? v : -v
  }
  return score
}

/** avaliação pela ótica de quem está na vez */
function evalSideToMove(s: ChessState): number {
  return s.turn === 0 ? evalWhite(s) : -evalWhite(s)
}

function isCapture(s: ChessState, m: ChessMove): boolean {
  return s.board[m.to] !== null || (s.board[m.from]?.t === 'p' && m.to === s.enPassant)
}

/** captura primeiro (vítima mais valiosa) — melhora a poda */
function order(s: ChessState, moves: ChessMove[]): ChessMove[] {
  return [...moves].sort((a, b) => value(s, b) - value(s, a))
}
function value(s: ChessState, m: ChessMove): number {
  const victim = s.board[m.to]
  return victim ? VAL[victim.t] : 0
}

function quiesce(s: ChessState, alpha: number, beta: number, ply: number): number {
  const standPat = evalSideToMove(s)
  if (ply >= QUIESCE_MAX) return standPat
  if (standPat >= beta) return beta
  if (standPat > alpha) alpha = standPat
  const caps = order(
    s,
    allLegalChessMoves(s).filter((m) => isCapture(s, m)),
  )
  for (const m of caps) {
    const val = -quiesce(applyChessRaw(s, m), -beta, -alpha, ply + 1)
    if (val >= beta) return beta
    if (val > alpha) alpha = val
  }
  return alpha
}

function negamax(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = allLegalChessMoves(s)
  if (moves.length === 0) {
    // sem lances: mate (ruim para quem está na vez) ou afogamento (0)
    return inCheck(s, s.turn) ? -MATE - depth : 0
  }
  if (depth === 0) return quiesce(s, alpha, beta, 0)
  let best = -INF
  for (const m of order(s, moves)) {
    best = Math.max(best, -negamax(applyChessRaw(s, m), depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

/** escolhe o lance do bot; entre lances quase iguais, sorteia */
export function chooseChessMove(
  s: ChessState,
  _seat: number,
): { from: number; to: number; promotion?: 'q' | 'r' | 'b' | 'n' } | null {
  const moves = allLegalChessMoves(s)
  if (moves.length === 0) return null

  let bestVal = -INF
  let best: ChessMove[] = []
  for (const m of order(s, moves)) {
    const val = -negamax(applyChessRaw(s, m), DEPTH - 1, -INF, INF)
    if (val > bestVal + 8) {
      bestVal = val
      best = [m]
    } else if (Math.abs(val - bestVal) <= 8) {
      best.push(m)
    }
  }
  const pick = best.length ? best[Math.floor(Math.random() * best.length)]! : moves[0]!
  return { from: pick.from, to: pick.to, promotion: pick.promotion }
}
