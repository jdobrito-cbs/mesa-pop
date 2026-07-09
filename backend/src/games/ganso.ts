import crypto from 'node:crypto'
import { aplicaRolagem, initialGansoState, type GansoState } from '@mesapop/shared'
import type { GameModule } from './module'

interface GansoAction {
  type: 'roll'
}

const dado = () => crypto.randomInt(1, 7)

/**
 * Corrida do Ganso — jogo de trilha para 2–4. Os DADOS são sorteados aqui no
 * servidor (fonte de verdade); a regra de movimento vive em `/shared`. Aceita
 * robô ("Jogar contra o robô"): o bot só rola o dado (é sorte pura).
 */
export const gansoModule: GameModule<GansoState, GansoAction> = {
  slug: 'ganso',
  minPlayers: 2,
  maxPlayers: 4,

  init(playerCount) {
    return initialGansoState(playerCount)
  },

  play(state, seat, action) {
    if (!action || action.type !== 'roll') return { error: 'Jogada inválida' }
    return aplicaRolagem(state, seat, [dado(), dado()])
  },

  // trilha é 100% visível
  getStateFor(state) {
    return state
  },

  currentSeat(state) {
    return state.winner !== null ? null : state.turn
  },

  bot() {
    return { type: 'roll' }
  },

  result(state) {
    return {
      finished: state.winner !== null,
      winnerSeats: state.winner !== null ? [state.winner] : [],
      draw: false,
    }
  },
}
