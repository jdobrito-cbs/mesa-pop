/**
 * Xadrez — regras COMPLETAS e puras, compartilhadas cliente/servidor.
 * O cliente usa a mesma lógica para destacar lances legais; o servidor
 * revalida tudo (fonte de verdade).
 *
 * Convenções:
 * - Tabuleiro = array de 64 (índice = linha*8 + coluna).
 * - Linha 0 = 8ª fileira (PRETAS no topo); linha 7 = 1ª fileira (BRANCAS).
 * - seat 0 = brancas, seat 1 = pretas.
 * - Regras cobertas: todos os movimentos, roque (com todas as restrições),
 *   en passant, promoção (com escolha), xeque, xeque-mate, afogamento,
 *   regra dos 50 lances, tripla repetição e material insuficiente.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type ChessColor = 0 | 1 // 0 = brancas, 1 = pretas

export interface ChessPiece {
  t: PieceType
  c: ChessColor
}

export interface ChessMove {
  from: number
  to: number
  /** peça da promoção (obrigatória ao coroar; 'q' se omitida) */
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export interface ChessState {
  board: (ChessPiece | null)[]
  turn: ChessColor
  /** direitos de roque: brancas/pretas × ala do rei/da dama */
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean }
  /** casa-alvo do en passant (índice) ou null */
  enPassant: number | null
  /** meios-lances desde a última captura/lance de peão (regra dos 50) */
  halfmove: number
  fullmove: number
  /** contagem de posições (tripla repetição) */
  positions: Record<string, number>
  /** último lance (para destacar na UI) */
  lastMove: ChessMove | null
}

export type ChessStatus =
  | { kind: 'playing'; inCheck: boolean }
  | { kind: 'checkmate'; winner: ChessColor }
  | { kind: 'stalemate' }
  | { kind: 'draw50' }
  | { kind: 'draw3x' }
  | { kind: 'drawMaterial' }

const BACK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']

export function initialChess(): ChessState {
  const board: (ChessPiece | null)[] = Array.from({ length: 64 }, () => null)
  for (let c = 0; c < 8; c++) {
    board[c] = { t: BACK[c]!, c: 1 }
    board[8 + c] = { t: 'p', c: 1 }
    board[48 + c] = { t: 'p', c: 0 }
    board[56 + c] = { t: BACK[c]!, c: 0 }
  }
  const state: ChessState = {
    board,
    turn: 0,
    castling: { wk: true, wq: true, bk: true, bq: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    positions: {},
    lastMove: null,
  }
  state.positions[positionKey(state)] = 1
  return state
}

export const rowOf = (i: number) => Math.floor(i / 8)
export const colOf = (i: number) => i % 8

function positionKey(s: ChessState): string {
  const b = s.board
    .map((p) => (p ? (p.c === 0 ? p.t.toUpperCase() : p.t) : '.'))
    .join('')
  const c = `${s.castling.wk ? 'K' : ''}${s.castling.wq ? 'Q' : ''}${s.castling.bk ? 'k' : ''}${s.castling.bq ? 'q' : ''}`
  return `${b}|${s.turn}|${c}|${s.enPassant ?? '-'}`
}

/** a casa `idx` está atacada por alguma peça da cor `by`? */
export function isAttacked(board: (ChessPiece | null)[], idx: number, by: ChessColor): boolean {
  const r = rowOf(idx)
  const c = colOf(idx)

  // peões (atacam "para frente" deles: brancas sobem, pretas descem)
  const pr = by === 0 ? r + 1 : r - 1
  for (const pc of [c - 1, c + 1]) {
    if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
      const p = board[pr * 8 + pc]
      if (p && p.c === by && p.t === 'p') return true
    }
  }
  // cavalos
  for (const [dr, dc] of [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
  ] as const) {
    const nr = r + dr
    const nc = c + dc
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue
    const p = board[nr * 8 + nc]
    if (p && p.c === by && p.t === 'n') return true
  }
  // rei adjacente
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue
      const p = board[nr * 8 + nc]
      if (p && p.c === by && p.t === 'k') return true
    }
  }
  // linhas/colunas (torre/dama) e diagonais (bispo/dama)
  const rays: Array<[number, number, PieceType]> = [
    [-1, 0, 'r'], [1, 0, 'r'], [0, -1, 'r'], [0, 1, 'r'],
    [-1, -1, 'b'], [-1, 1, 'b'], [1, -1, 'b'], [1, 1, 'b'],
  ]
  for (const [dr, dc, slider] of rays) {
    let nr = r + dr
    let nc = c + dc
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc]
      if (p) {
        if (p.c === by && (p.t === slider || p.t === 'q')) return true
        break
      }
      nr += dr
      nc += dc
    }
  }
  return false
}

export function kingIndex(board: (ChessPiece | null)[], color: ChessColor): number {
  return board.findIndex((p) => p?.t === 'k' && p.c === color)
}

export function inCheck(s: ChessState, color: ChessColor): boolean {
  return isAttacked(s.board, kingIndex(s.board, color), color === 0 ? 1 : 0)
}

/** lances PSEUDO-legais da peça (sem checar a segurança do rei) */
function pseudoMoves(s: ChessState, from: number): ChessMove[] {
  const piece = s.board[from]
  if (!piece) return []
  const out: ChessMove[] = []
  const r = rowOf(from)
  const c = colOf(from)
  const push = (to: number) => out.push({ from, to })

  if (piece.t === 'p') {
    const dir = piece.c === 0 ? -1 : 1
    const startRow = piece.c === 0 ? 6 : 1
    const one = (r + dir) * 8 + c
    if (r + dir >= 0 && r + dir <= 7 && !s.board[one]) {
      push(one)
      const two = (r + 2 * dir) * 8 + c
      if (r === startRow && !s.board[two]) push(two)
    }
    for (const dc of [-1, 1]) {
      const nc = c + dc
      const nr = r + dir
      if (nc < 0 || nc > 7 || nr < 0 || nr > 7) continue
      const to = nr * 8 + nc
      const target = s.board[to]
      if (target && target.c !== piece.c) push(to)
      else if (to === s.enPassant) push(to) // captura en passant
    }
  } else if (piece.t === 'n') {
    for (const [dr, dc] of [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
    ] as const) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue
      const target = s.board[nr * 8 + nc]
      if (!target || target.c !== piece.c) push(nr * 8 + nc)
    }
  } else if (piece.t === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue
        const target = s.board[nr * 8 + nc]
        if (!target || target.c !== piece.c) push(nr * 8 + nc)
      }
    }
    // roque: rei e torre intactos, caminho livre, sem xeque no percurso
    const enemy: ChessColor = piece.c === 0 ? 1 : 0
    const home = piece.c === 0 ? 56 : 0
    const rights = piece.c === 0 ? s.castling.wk : s.castling.bk
    const rightsQ = piece.c === 0 ? s.castling.wq : s.castling.bq
    if (from === home + 4 && !isAttacked(s.board, from, enemy)) {
      if (
        rights &&
        !s.board[home + 5] &&
        !s.board[home + 6] &&
        s.board[home + 7]?.t === 'r' &&
        s.board[home + 7]?.c === piece.c &&
        !isAttacked(s.board, home + 5, enemy) &&
        !isAttacked(s.board, home + 6, enemy)
      ) {
        push(home + 6)
      }
      if (
        rightsQ &&
        !s.board[home + 3] &&
        !s.board[home + 2] &&
        !s.board[home + 1] &&
        s.board[home]?.t === 'r' &&
        s.board[home]?.c === piece.c &&
        !isAttacked(s.board, home + 3, enemy) &&
        !isAttacked(s.board, home + 2, enemy)
      ) {
        push(home + 2)
      }
    }
  } else {
    const dirs =
      piece.t === 'r'
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : piece.t === 'b'
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
    for (const [dr, dc] of dirs as Array<[number, number]>) {
      let nr = r + dr
      let nc = c + dc
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const target = s.board[nr * 8 + nc]
        if (!target) push(nr * 8 + nc)
        else {
          if (target.c !== piece.c) push(nr * 8 + nc)
          break
        }
        nr += dr
        nc += dc
      }
    }
  }
  return out
}

/** aplica o lance SEM validar (uso interno; assume pseudo-legal) */
function applyRaw(s: ChessState, move: ChessMove): ChessState {
  const board = s.board.slice()
  const piece = board[move.from]!
  const isPawn = piece.t === 'p'
  const captured = board[move.to]
  const next: ChessState = {
    board,
    turn: s.turn === 0 ? 1 : 0,
    castling: { ...s.castling },
    enPassant: null,
    halfmove: isPawn || captured ? 0 : s.halfmove + 1,
    fullmove: s.turn === 1 ? s.fullmove + 1 : s.fullmove,
    positions: s.positions,
    lastMove: move,
  }

  // en passant: remove o peão capturado (que não está na casa de destino)
  if (isPawn && move.to === s.enPassant && !captured) {
    const dir = piece.c === 0 ? 1 : -1
    board[move.to + dir * 8] = null
    next.halfmove = 0
  }
  // peão andou duas: marca a casa do en passant
  if (isPawn && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
    next.enPassant = (move.from + move.to) / 2
  }
  // roque: move a torre junto
  if (piece.t === 'k' && Math.abs(colOf(move.to) - colOf(move.from)) === 2) {
    const home = piece.c === 0 ? 56 : 0
    if (move.to === home + 6) {
      board[home + 5] = board[home + 7] ?? null
      board[home + 7] = null
    } else {
      board[home + 3] = board[home] ?? null
      board[home] = null
    }
  }
  // direitos de roque
  if (piece.t === 'k') {
    if (piece.c === 0) {
      next.castling.wk = false
      next.castling.wq = false
    } else {
      next.castling.bk = false
      next.castling.bq = false
    }
  }
  for (const idx of [move.from, move.to]) {
    if (idx === 56) next.castling.wq = false
    if (idx === 63) next.castling.wk = false
    if (idx === 0) next.castling.bq = false
    if (idx === 7) next.castling.bk = false
  }

  board[move.to] = piece
  board[move.from] = null
  // promoção
  if (isPawn && (rowOf(move.to) === 0 || rowOf(move.to) === 7)) {
    board[move.to] = { t: move.promotion ?? 'q', c: piece.c }
  }
  return next
}

/**
 * Aplica um lance pseudo-legal SEM validar nem atualizar a contagem de
 * posições — exposto para a busca da IA (bot), que precisa simular muitos
 * lances rápido. Não usar para aplicar o lance oficial (use applyChessMove).
 */
export function applyChessRaw(s: ChessState, move: ChessMove): ChessState {
  return applyRaw(s, move)
}

/** lances LEGAIS da peça (rei não pode ficar em xeque) */
export function legalChessMoves(s: ChessState, from: number): ChessMove[] {
  const piece = s.board[from]
  if (!piece || piece.c !== s.turn) return []
  return pseudoMoves(s, from).filter((m) => {
    const after = applyRaw(s, m)
    return !isAttacked(after.board, kingIndex(after.board, piece.c), piece.c === 0 ? 1 : 0)
  })
}

export function allLegalChessMoves(s: ChessState): ChessMove[] {
  const out: ChessMove[] = []
  for (let i = 0; i < 64; i++) {
    if (s.board[i]?.c === s.turn) out.push(...legalChessMoves(s, i))
  }
  return out
}

/** material insuficiente: K×K, K+B×K, K+N×K, K+B×K+B (bispos na mesma cor) */
function insufficientMaterial(board: (ChessPiece | null)[]): boolean {
  const pieces: Array<{ p: ChessPiece; i: number }> = []
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (p && p.t !== 'k') pieces.push({ p, i })
  }
  if (pieces.length === 0) return true
  if (pieces.length === 1) return pieces[0]!.p.t === 'b' || pieces[0]!.p.t === 'n'
  if (pieces.length === 2 && pieces.every(({ p }) => p.t === 'b')) {
    const shade = ({ i }: { i: number }) => (rowOf(i) + colOf(i)) % 2
    return pieces[0]!.p.c !== pieces[1]!.p.c && shade(pieces[0]!) === shade(pieces[1]!)
  }
  return false
}

export function chessStatus(s: ChessState): ChessStatus {
  const hasMove = allLegalChessMoves(s).length > 0
  const check = inCheck(s, s.turn)
  if (!hasMove) {
    if (check) return { kind: 'checkmate', winner: s.turn === 0 ? 1 : 0 }
    return { kind: 'stalemate' }
  }
  if (s.halfmove >= 100) return { kind: 'draw50' }
  if ((s.positions[positionKey(s)] ?? 0) >= 3) return { kind: 'draw3x' }
  if (insufficientMaterial(s.board)) return { kind: 'drawMaterial' }
  return { kind: 'playing', inCheck: check }
}

/** valida e aplica o lance do assento (0 = brancas, 1 = pretas) */
export function applyChessMove(
  s: ChessState,
  seat: number,
  move: ChessMove,
): { error: string } | { state: ChessState } {
  if (chessStatus(s).kind !== 'playing') return { error: 'A partida já terminou' }
  if (seat !== s.turn) return { error: 'Não é a sua vez' }
  const piece = s.board[move.from]
  if (!piece || piece.c !== seat) return { error: 'Escolha uma peça sua' }
  const legal = legalChessMoves(s, move.from).some((m) => m.to === move.to)
  if (!legal) return { error: 'Lance ilegal' }
  if (move.promotion && !['q', 'r', 'b', 'n'].includes(move.promotion)) {
    return { error: 'Promoção inválida' }
  }
  const next = applyRaw(s, { ...move, promotion: move.promotion ?? 'q' })
  next.positions = { ...s.positions }
  const key = positionKey(next)
  next.positions[key] = (next.positions[key] ?? 0) + 1
  return { state: next }
}
