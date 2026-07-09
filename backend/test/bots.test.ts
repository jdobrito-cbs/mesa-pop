import { describe, expect, it } from 'vitest'
import {
  allLegalChessMoves,
  applyChessMove,
  applyMove,
  chessStatus,
  findMove,
  initialCheckersState,
  legalMoves,
  type ChessPiece,
  type ChessState,
} from '@mesapop/shared'
import { chooseCheckersMove } from '../src/games/checkersBot'
import { chooseChessMove } from '../src/games/chessBot'
import { checkersModule } from '../src/games/checkers'
import { chessModule } from '../src/games/chess'

/** tabuleiro de xadrez vazio, brancas na vez (para montar posições de teste) */
function emptyChess(): ChessState {
  return {
    board: Array<ChessPiece | null>(64).fill(null),
    turn: 0,
    castling: { wk: false, wq: false, bk: false, bq: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    positions: {},
    lastMove: null,
  }
}

describe('Bot de Damas', () => {
  it('sempre devolve um lance LEGAL na abertura', () => {
    const s = initialCheckersState()
    const mv = chooseCheckersMove(s, s.turn)
    expect(mv).not.toBeNull()
    expect(findMove(s, mv!.from, mv!.to)).not.toBeNull()
  })

  it('joga 24 meios-lances contra si mesmo sem nunca gerar lance ilegal', () => {
    let s = initialCheckersState()
    for (let i = 0; i < 24 && s.winner === null && !s.draw; i++) {
      const mv = chooseCheckersMove(s, s.turn)
      expect(mv).not.toBeNull()
      const move = findMove(s, mv!.from, mv!.to)
      expect(move).not.toBeNull()
      s = applyMove(s, move!)
    }
  })

  it('currentSeat é o jogador da vez e null quando termina', () => {
    const s = initialCheckersState()
    expect(checkersModule.currentSeat!(s)).toBe(s.turn)
    expect(checkersModule.currentSeat!({ ...s, winner: 0 })).toBeNull()
  })
})

describe('Bot de Xadrez', () => {
  it('sempre devolve um lance LEGAL na abertura', () => {
    const s = chessModule.init(2) as ChessState
    const mv = chooseChessMove(s, 0)
    expect(mv).not.toBeNull()
    const legal = allLegalChessMoves(s).some((m) => m.from === mv!.from && m.to === mv!.to)
    expect(legal).toBe(true)
  })

  it('captura a dama pendurada (não deixa material de graça)', () => {
    const s = emptyChess()
    s.board[60] = { t: 'k', c: 0 } // rei branco e1
    s.board[4] = { t: 'k', c: 1 } // rei preto e8
    s.board[56] = { t: 'r', c: 0 } // torre branca a1
    s.board[0] = { t: 'q', c: 1 } // dama preta a8, sem defesa
    const mv = chooseChessMove(s, 0)
    expect(mv).not.toBeNull()
    // torre a1 x dama a8 (índice 0) — o melhor lance disparado
    expect(mv!.to).toBe(0)
    expect(mv!.from).toBe(56)
  })

  it('acha o mate de corredor em 1', () => {
    const s = emptyChess()
    s.board[60] = { t: 'k', c: 0 } // rei branco e1
    s.board[56] = { t: 'r', c: 0 } // torre branca a1
    s.board[6] = { t: 'k', c: 1 } // rei preto g8
    s.board[13] = { t: 'p', c: 1 } // peão f7
    s.board[14] = { t: 'p', c: 1 } // peão g7
    s.board[15] = { t: 'p', c: 1 } // peão h7
    const mv = chooseChessMove(s, 0)
    expect(mv).not.toBeNull()
    expect(mv!.to).toBe(0) // Ta8#
    const outcome = applyChessMove(s, 0, { from: mv!.from, to: mv!.to })
    expect('state' in outcome).toBe(true)
    if ('state' in outcome) {
      expect(chessStatus(outcome.state).kind).toBe('checkmate')
    }
  })

  it('currentSeat null quando a partida acabou (mate)', () => {
    const s = emptyChess()
    s.board[0] = { t: 'k', c: 1 } // rei preto a8
    s.board[9] = { t: 'q', c: 0 } // dama branca b7 dá xeque
    s.board[18] = { t: 'k', c: 0 } // rei branco c6 defende a dama -> mate
    s.turn = 1 // pretas na vez, sem lances (mate de dama apoiada)
    expect(chessStatus(s).kind).toBe('checkmate')
    expect(chessModule.currentSeat!(s)).toBeNull()
  })
})
