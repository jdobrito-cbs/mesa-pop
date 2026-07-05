import {
  applyOneAction,
  initialOneState,
  oneViewFor,
  type OneAction,
  type OneState,
} from '@mesapop/shared'
import type { GameModule } from './module'

export const oneModule: GameModule<OneState, OneAction> = {
  slug: 'one',
  minPlayers: 2,
  maxPlayers: 4,

  init(playerCount) {
    return initialOneState(playerCount)
  },

  play(state, seat, action) {
    if (!action || !['play', 'draw', 'keep'].includes(action.type)) {
      return { error: 'Jogada inválida' }
    }
    return applyOneAction(state, seat, action)
  },

  // MÃO ESCONDIDA: cada assento só recebe a própria mão + contagens.
  getStateFor(state, seat) {
    return oneViewFor(state, seat)
  },

  result(state) {
    return {
      finished: state.winnerSeats.length > 0,
      winnerSeats: state.winnerSeats,
      draw: false,
    }
  },
}
