import {
  applyChessMove,
  chessStatus,
  initialChess,
  type ChessState,
} from '@mesapop/shared'
import type { GameModule } from './module'
import { chooseChessMove } from './chessBot'

interface ChessAction {
  from: number
  to: number
  promotion?: 'q' | 'r' | 'b' | 'n'
}

/**
 * Xadrez — estado 100% visível; espectadores assistem e a mesa roda em
 * fila estilo bar (perdedor sai, próximo da fila entra, vencedor fica),
 * como no Dominó.
 */
export const chessModule: GameModule<ChessState, ChessAction> = {
  slug: 'xadrez',
  minPlayers: 2,
  maxPlayers: 2,
  allowSpectators: true,
  rotation: true,

  init() {
    return initialChess()
  },

  play(state, seat, action) {
    if (
      typeof action?.from !== 'number' ||
      typeof action?.to !== 'number' ||
      action.from < 0 ||
      action.from > 63 ||
      action.to < 0 ||
      action.to > 63
    ) {
      return { error: 'Jogada inválida' }
    }
    return applyChessMove(state, seat, {
      from: action.from,
      to: action.to,
      promotion: action.promotion,
    })
  },

  // xadrez é 100% visível: mesma visão para jogadores e espectadores
  getStateFor(state) {
    return state
  },

  currentSeat(state) {
    return chessStatus(state).kind === 'playing' ? state.turn : null
  },

  bot(state, seat) {
    return chooseChessMove(state, seat)
  },

  result(state) {
    const status = chessStatus(state)
    return {
      finished: status.kind !== 'playing',
      winnerSeats: status.kind === 'checkmate' ? [status.winner] : [],
      draw: status.kind !== 'playing' && status.kind !== 'checkmate',
    }
  },
}
