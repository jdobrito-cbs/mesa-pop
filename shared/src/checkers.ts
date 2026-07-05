/**
 * Damas (regras brasileiras) — lógica pura e compartilhada.
 * O servidor é a fonte de verdade: valida cada lance com estas funções.
 * O cliente usa as mesmas funções apenas para destacar lances possíveis.
 *
 * Regras implementadas:
 * - Tabuleiro 8x8, 12 peças por lado nas casas escuras.
 * - Peão move 1 casa na diagonal para frente; captura para frente E para trás.
 * - Dama (rei) voa: anda e captura a qualquer distância na diagonal.
 * - Captura é OBRIGATÓRIA, com lei da maioria (maior número de peças).
 * - Cadeia de capturas continua com a mesma peça até não haver mais captura.
 * - Promoção ao parar na última fileira (não no meio de uma cadeia).
 * - Empate: 40 lances seguidos sem captura e sem movimento de peão.
 */

export type PlayerIdx = 0 | 1

export interface Piece {
  /** dono: 0 (magenta, move para "cima": índices menores) | 1 (ciano) */
  p: PlayerIdx
  /** é dama? */
  k: boolean
}

export interface CheckersMove {
  from: number
  to: number
  /** índices das peças capturadas, na ordem */
  captures: number[]
}

export interface CheckersState {
  /** 64 casas, índice = linha*8+coluna; linha 0 no topo */
  board: (Piece | null)[]
  turn: PlayerIdx
  /** se no meio de cadeia de captura, casa da peça que deve continuar */
  chainFrom: number | null
  /** lances sem captura e sem movimento de peão (empate aos 40) */
  quietMoves: number
  winner: PlayerIdx | null
  draw: boolean
}

const SIZE = 8
export const row = (i: number) => Math.floor(i / SIZE)
export const col = (i: number) => i % SIZE
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE
export const isDark = (i: number) => (row(i) + col(i)) % 2 === 1

const DIAGONALS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

/** jogador 0 anda para cima (dr = -1); jogador 1 para baixo (dr = +1) */
const forwardOf = (p: PlayerIdx) => (p === 0 ? -1 : 1)
const lastRowOf = (p: PlayerIdx) => (p === 0 ? 0 : SIZE - 1)

export function initialCheckersState(): CheckersState {
  const board: (Piece | null)[] = Array(64).fill(null)
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue
    if (row(i) < 3) board[i] = { p: 1, k: false }
    if (row(i) > 4) board[i] = { p: 0, k: false }
  }
  return { board, turn: 0, chainFrom: null, quietMoves: 0, winner: null, draw: false }
}

/** Todas as sequências de captura a partir de uma peça (DFS). */
function captureChains(
  board: (Piece | null)[],
  from: number,
  piece: Piece,
  captured: number[],
): CheckersMove[] {
  const results: CheckersMove[] = []
  const r = row(from)
  const c = col(from)

  for (const [dr, dc] of DIAGONALS) {
    if (piece.k) {
      // dama voadora: procura a primeira peça na diagonal
      let rr = r + dr
      let cc = c + dc
      while (inside(rr, cc) && board[rr * 8 + cc] === null) {
        rr += dr
        cc += dc
      }
      if (!inside(rr, cc)) continue
      const targetIdx = rr * 8 + cc
      const target = board[targetIdx]
      if (!target || target.p === piece.p || captured.includes(targetIdx)) continue
      // casas de pouso após a peça capturada
      let lr = rr + dr
      let lc = cc + dc
      while (inside(lr, lc) && board[lr * 8 + lc] === null) {
        const landing = lr * 8 + lc
        const nextCaptured = [...captured, targetIdx]
        const deeper = captureChainsFromLanding(board, from, landing, piece, nextCaptured)
        if (deeper.length) {
          results.push(...deeper)
        } else {
          results.push({ from: -1, to: landing, captures: nextCaptured })
        }
        lr += dr
        lc += dc
      }
    } else {
      // peão captura de qualquer direção pulando peça adjacente
      const mr = r + dr
      const mc = c + dc
      const lr = r + 2 * dr
      const lc = c + 2 * dc
      if (!inside(lr, lc)) continue
      const midIdx = mr * 8 + mc
      const landing = lr * 8 + lc
      const mid = board[midIdx]
      if (!mid || mid.p === piece.p || captured.includes(midIdx)) continue
      if (board[landing] !== null) continue
      const nextCaptured = [...captured, midIdx]
      const deeper = captureChainsFromLanding(board, from, landing, piece, nextCaptured)
      if (deeper.length) {
        results.push(...deeper)
      } else {
        results.push({ from: -1, to: landing, captures: nextCaptured })
      }
    }
  }
  return results
}

/** Continua a DFS a partir de uma casa de pouso (peças capturadas ficam no tabuleiro até o fim). */
function captureChainsFromLanding(
  board: (Piece | null)[],
  origin: number,
  landing: number,
  piece: Piece,
  captured: number[],
): CheckersMove[] {
  // move a peça temporariamente (sem remover capturadas — regra oficial:
  // peça capturada só sai no fim, e não pode ser saltada duas vezes)
  const tempBoard = board.slice()
  tempBoard[origin] = null
  tempBoard[landing] = piece
  const deeper = captureChains(tempBoard, landing, piece, captured)
  return deeper
}

/** Lances legais do jogador da vez (já aplica captura obrigatória + maioria). */
export function legalMoves(state: CheckersState): CheckersMove[] {
  if (state.winner !== null || state.draw) return []
  const { board, turn } = state

  const captures: CheckersMove[] = []
  const quiet: CheckersMove[] = []

  const origins =
    state.chainFrom !== null
      ? [state.chainFrom]
      : board.map((pc, i) => (pc && pc.p === turn ? i : -1)).filter((i) => i >= 0)

  for (const from of origins) {
    const piece = board[from]!
    const chains = captureChains(board, from, piece, [])
    for (const ch of chains) captures.push({ ...ch, from })

    if (state.chainFrom === null) {
      const r = row(from)
      const c = col(from)
      if (piece.k) {
        for (const [dr, dc] of DIAGONALS) {
          let rr = r + dr
          let cc = c + dc
          while (inside(rr, cc) && board[rr * 8 + cc] === null) {
            quiet.push({ from, to: rr * 8 + cc, captures: [] })
            rr += dr
            cc += dc
          }
        }
      } else {
        const dr = forwardOf(turn)
        for (const dc of [-1, 1]) {
          const rr = r + dr
          const cc = c + dc
          if (inside(rr, cc) && board[rr * 8 + cc] === null) {
            quiet.push({ from, to: rr * 8 + cc, captures: [] })
          }
        }
      }
    }
  }

  if (captures.length) {
    // lei da maioria: só valem as capturas de comprimento máximo
    const max = Math.max(...captures.map((m) => m.captures.length))
    return captures.filter((m) => m.captures.length === max)
  }
  return quiet
}

/** Aplica um lance já validado. Retorna novo estado. */
export function applyMove(state: CheckersState, move: CheckersMove): CheckersState {
  const board = state.board.slice()
  const piece = { ...board[move.from]! }
  board[move.from] = null
  for (const cap of move.captures) board[cap] = null

  const isCapture = move.captures.length > 0
  let chainFrom: number | null = null

  board[move.to] = piece

  // promoção: só ao PARAR na última fileira
  const landedLastRow = row(move.to) === lastRowOf(piece.p)

  if (isCapture) {
    // a cadeia já vem completa em `captures` (DFS até o fim),
    // então não há continuação pendente.
    chainFrom = null
  }
  if (landedLastRow && !piece.k) {
    board[move.to] = { ...piece, k: true }
  }

  const quietMoves = isCapture || !piece.k ? 0 : state.quietMoves + 1
  const turn: PlayerIdx = state.turn === 0 ? 1 : 0

  const next: CheckersState = {
    board,
    turn,
    chainFrom,
    quietMoves,
    winner: null,
    draw: false,
  }

  // fim de jogo: adversário sem peças ou sem lances
  const opponentMoves = legalMoves(next)
  const opponentPieces = board.some((pc) => pc && pc.p === turn)
  if (!opponentPieces || opponentMoves.length === 0) {
    next.winner = state.turn
  } else if (quietMoves >= 40) {
    next.draw = true
  }
  return next
}

/** Valida a intenção {from, to} do cliente contra os lances legais. */
export function findMove(state: CheckersState, from: number, to: number): CheckersMove | null {
  return legalMoves(state).find((m) => m.from === from && m.to === to) ?? null
}

export function countPieces(state: CheckersState, player: PlayerIdx): number {
  return state.board.filter((pc) => pc && pc.p === player).length
}
