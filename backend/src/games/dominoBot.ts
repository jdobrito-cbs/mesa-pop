import {
  applyDominoAction,
  playableSides,
  type ArmIndex,
  type DominoAction,
  type DominoState,
  type DominoTile,
} from '@mesapop/shared'

/**
 * Bot de Dominó (All Fives) — nível equilibrado. Só olha a PRÓPRIA mão e o
 * estado público da mesa. Greedy: joga a pedra/ponta que mais PONTUA para a
 * dupla agora; empate → solta a pedra mais pesada; evita bater atrás no placar.
 */

const pipsOf = (t: DominoTile) => t[0] + t[1]

export function chooseDominoAction(state: DominoState, seat: number): DominoAction | null {
  if (state.winnerSeats.length || state.draw) return null
  if (state.turn !== seat) return null

  // abertura obrigatória com o [6|6]
  if (state.awaitingOpener) {
    return { type: 'play', tile: [6, 6], side: 0 }
  }

  const hand = state.hands[seat] ?? []
  const candidates: { tile: DominoTile; side: ArmIndex }[] = []
  for (const tile of hand) {
    for (const side of playableSides(state, tile)) {
      candidates.push({ tile, side })
    }
  }
  if (candidates.length === 0) return { type: 'pass' }

  const team = seat % 2
  let bestVal = -Infinity
  let best: { tile: DominoTile; side: ArmIndex }[] = []
  for (const c of candidates) {
    const outcome = applyDominoAction(state, seat, { type: 'play', tile: c.tile, side: c.side })
    if ('error' in outcome) continue
    const ns = outcome.state
    const gained = ns.scores[team]! - state.scores[team]!
    // pontos primeiro; solta pedra pesada como desempate
    let val = gained * 10 + pipsOf(c.tile) * 0.1
    // bater só compensa se a nossa dupla ganhar a mão
    if (ns.winnerSeats.length) {
      val += ns.winnerSeats.includes(seat) ? 1000 : -1000
    }
    if (val > bestVal + 1e-6) {
      bestVal = val
      best = [c]
    } else if (Math.abs(val - bestVal) <= 1e-6) {
      best.push(c)
    }
  }
  const pick = best[Math.floor(Math.random() * best.length)] ?? candidates[0]!
  return { type: 'play', tile: pick.tile, side: pick.side }
}
