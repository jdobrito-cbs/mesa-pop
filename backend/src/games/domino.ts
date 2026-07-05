import {
  applyDominoAction,
  dominoViewFor,
  initialDominoState,
  DOMINO_DEFAULT_TARGET,
  type DominoAction,
  type DominoState,
} from '@mesapop/shared'
import type { GameModule } from './module'

export const dominoModule: GameModule<DominoState, DominoAction> = {
  slug: 'domino',
  minPlayers: 4,
  maxPlayers: 4,
  seatPicking: true,
  allowSpectators: true,
  rotation: true,

  init() {
    // alvo da partida (múltiplos de 5); override por env facilita testes
    const target = Number(process.env.DOMINO_TARGET ?? DOMINO_DEFAULT_TARGET)
    return initialDominoState(Math.random, target)
  },

  play(state, seat, action) {
    if (!action || (action.type !== 'play' && action.type !== 'pass')) {
      return { error: 'Jogada inválida' }
    }
    return applyDominoAction(state, seat, action)
  },

  // MÃO ESCONDIDA: cada assento só recebe a própria mão + contagens.
  getStateFor(state, seat) {
    return dominoViewFor(state, seat)
  },

  result(state) {
    return {
      finished: state.winnerSeats.length > 0 || state.draw,
      winnerSeats: state.winnerSeats,
      draw: state.draw,
    }
  },
}
