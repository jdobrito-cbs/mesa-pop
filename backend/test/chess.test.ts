import { describe, expect, it } from 'vitest'
import {
  allLegalChessMoves,
  applyChessMove,
  chessStatus,
  initialChess,
  legalChessMoves,
  type ChessColor,
  type ChessPiece,
  type ChessState,
  type PieceType,
} from '@mesapop/shared'

/** 'e4' → índice no tabuleiro (linha 0 = 8ª fileira) */
const SQ = (s: string) => (8 - Number(s[1])) * 8 + (s.charCodeAt(0) - 97)

function play(s: ChessState, seat: number, from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') {
  const res = applyChessMove(s, seat, { from: SQ(from), to: SQ(to), promotion })
  if ('error' in res) throw new Error(`${from}->${to}: ${res.error}`)
  return res.state
}

function custom(pieces: Array<[string, PieceType, ChessColor]>, turn: ChessColor): ChessState {
  const board: (ChessPiece | null)[] = Array.from({ length: 64 }, () => null)
  for (const [at, t, c] of pieces) board[SQ(at)] = { t, c }
  return {
    board,
    turn,
    castling: { wk: false, wq: false, bk: false, bq: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    positions: {},
    lastMove: null,
  }
}

const canGo = (s: ChessState, from: string, to: string) =>
  legalChessMoves(s, SQ(from)).some((m) => m.to === SQ(to))

describe('xadrez — regras compartilhadas', () => {
  it('abertura: peão anda 1 ou 2; vez alterna; fora da vez é rejeitado', () => {
    let s = initialChess()
    expect(canGo(s, 'e2', 'e3')).toBe(true)
    expect(canGo(s, 'e2', 'e4')).toBe(true)
    expect(canGo(s, 'e2', 'e5')).toBe(false)
    const wrong = applyChessMove(s, 1, { from: SQ('e7'), to: SQ('e5') })
    expect('error' in wrong && wrong.error).toBe('Não é a sua vez')
    s = play(s, 0, 'e2', 'e4')
    expect(s.turn).toBe(1)
  })

  it('peça não atravessa outra (bispo preso na abertura)', () => {
    const s = initialChess()
    expect(legalChessMoves(s, SQ('c1'))).toHaveLength(0)
  })

  it('peça cravada não pode sair da linha do rei', () => {
    // torre preta em e8 crava o cavalo branco em e4 contra o rei em e1
    const s = custom(
      [
        ['e1', 'k', 0],
        ['e4', 'n', 0],
        ['e8', 'r', 1],
        ['a8', 'k', 1],
      ],
      0,
    )
    expect(legalChessMoves(s, SQ('e4'))).toHaveLength(0)
  })

  it('en passant: só na jogada imediata', () => {
    let s = initialChess()
    s = play(s, 0, 'e2', 'e4')
    s = play(s, 1, 'a7', 'a6')
    s = play(s, 0, 'e4', 'e5')
    s = play(s, 1, 'd7', 'd5') // peão passa colado
    expect(canGo(s, 'e5', 'd6')).toBe(true) // en passant disponível
    const after = play(s, 0, 'e5', 'd6')
    expect(after.board[SQ('d5')]).toBeNull() // peão capturado saiu

    // se as brancas jogarem outra coisa, o direito EXPIRA
    let t = play(s, 0, 'b1', 'c3')
    t = play(t, 1, 'a6', 'a5')
    expect(canGo(t, 'e5', 'd6')).toBe(false)
  })

  it('roque pequeno funciona; através de xeque ou após mover o rei, não', () => {
    // caminho livre para o roque branco pequeno
    const base: Array<[string, PieceType, ChessColor]> = [
      ['e1', 'k', 0],
      ['h1', 'r', 0],
      ['e8', 'k', 1],
    ]
    let s = custom(base, 0)
    s.castling.wk = true
    expect(canGo(s, 'e1', 'g1')).toBe(true)
    const after = play(s, 0, 'e1', 'g1')
    expect(after.board[SQ('f1')]?.t).toBe('r') // torre pulou junto
    expect(after.board[SQ('g1')]?.t).toBe('k')

    // torre inimiga mirando f1: o rei atravessaria o xeque
    s = custom([...base, ['f8', 'r', 1]], 0)
    s.castling.wk = true
    expect(canGo(s, 'e1', 'g1')).toBe(false)

    // rei já se moveu: direito perdido
    s = custom(base, 0)
    s.castling.wk = true
    let t = play(s, 0, 'e1', 'e2')
    t = play(t, 1, 'e8', 'e7')
    t = play(t, 0, 'e2', 'e1')
    t = play(t, 1, 'e7', 'e8')
    expect(canGo(t, 'e1', 'g1')).toBe(false)
  })

  it('promoção: dama por padrão, cavalo por escolha', () => {
    const s = custom(
      [
        ['a7', 'p', 0],
        ['e1', 'k', 0],
        ['e8', 'k', 1],
        ['h7', 'p', 1],
      ],
      0,
    )
    const queen = play(s, 0, 'a7', 'a8')
    expect(queen.board[SQ('a8')]).toEqual({ t: 'q', c: 0 })
    const knight = play(s, 0, 'a7', 'a8', 'n')
    expect(knight.board[SQ('a8')]).toEqual({ t: 'n', c: 0 })
  })

  it('mate do louco: xeque-mate mais rápido do jogo (pretas vencem)', () => {
    let s = initialChess()
    s = play(s, 0, 'f2', 'f3')
    s = play(s, 1, 'e7', 'e5')
    s = play(s, 0, 'g2', 'g4')
    s = play(s, 1, 'd8', 'h4')
    expect(chessStatus(s)).toEqual({ kind: 'checkmate', winner: 1 })
    // partida acabou: nada mais entra
    const extra = applyChessMove(s, 0, { from: SQ('e2'), to: SQ('e3') })
    expect('error' in extra).toBe(true)
  })

  it('mate do pastor: brancas vencem em 4 lances', () => {
    let s = initialChess()
    s = play(s, 0, 'e2', 'e4')
    s = play(s, 1, 'e7', 'e5')
    s = play(s, 0, 'f1', 'c4')
    s = play(s, 1, 'b8', 'c6')
    s = play(s, 0, 'd1', 'h5')
    expect(chessStatus(s)).toEqual({ kind: 'playing', inCheck: false })
    s = play(s, 1, 'g8', 'f6')
    s = play(s, 0, 'h5', 'f7')
    expect(chessStatus(s)).toEqual({ kind: 'checkmate', winner: 0 })
  })

  it('afogamento: sem lances e sem xeque = empate', () => {
    const s = custom(
      [
        ['a8', 'k', 1],
        ['b6', 'k', 0],
        ['c7', 'q', 0],
      ],
      1,
    )
    expect(allLegalChessMoves(s)).toHaveLength(0)
    expect(chessStatus(s)).toEqual({ kind: 'stalemate' })
  })

  it('empates: 50 lances e material insuficiente', () => {
    const fifty = custom(
      [
        ['e1', 'k', 0],
        ['e8', 'k', 1],
        ['a1', 'r', 0],
      ],
      0,
    )
    fifty.halfmove = 100
    expect(chessStatus(fifty).kind).toBe('draw50')

    const material = custom(
      [
        ['e1', 'k', 0],
        ['e8', 'k', 1],
        ['b8', 'n', 1],
      ],
      0,
    )
    expect(chessStatus(material).kind).toBe('drawMaterial')
  })

  it('tripla repetição: cavalos dançando = empate', () => {
    let s = initialChess()
    const shuffle = [
      ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
    ] as const
    for (let round = 0; round < 2; round++) {
      for (const [i, [from, to]] of shuffle.entries()) {
        s = play(s, i % 2 === 0 ? 0 : 1, from, to)
      }
    }
    expect(chessStatus(s).kind).toBe('draw3x')
  })

  it('xeque é sinalizado e só sai dele com lance que defende', () => {
    const s = custom(
      [
        ['e1', 'k', 0],
        ['e8', 'r', 1],
        ['a8', 'k', 1],
        ['d2', 'q', 0],
      ],
      0,
    )
    expect(chessStatus(s)).toEqual({ kind: 'playing', inCheck: true })
    // a dama pode bloquear em e2/e3... mas não pode ir para longe (a5 não defende)
    expect(canGo(s, 'd2', 'e2')).toBe(true)
    expect(canGo(s, 'd2', 'a5')).toBe(false)
  })
})
