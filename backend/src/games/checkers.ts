import {
  applyMove,
  findMove,
  initialCheckersState,
  type CheckersState,
} from '@mesapop/shared'
import type { GameModule } from './module'

interface CheckersAction {
  from: number
  to: number
}

export const checkersModule: GameModule<CheckersState, CheckersAction> = {
  slug: 'damas',
  minPlayers: 2,
  maxPlayers: 2,

  init() {
    return initialCheckersState()
  },

  play(state, seat, action) {
    if (state.winner !== null || state.draw) return { error: 'A partida já terminou' }
    if (state.turn !== seat) return { error: 'Não é a sua vez' }
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
    const move = findMove(state, action.from, action.to)
    if (!move) return { error: 'Jogada inválida' }
    return { state: applyMove(state, move) }
  },

  // damas é 100% visível: mesma visão para os dois
  getStateFor(state) {
    return state
  },

  result(state) {
    return {
      finished: state.winner !== null || state.draw,
      winnerSeats: state.winner === null ? [] : [state.winner],
      draw: state.draw,
    }
  },
}
