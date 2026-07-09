import { canPlayCard, type OneAction, type OneCard, type OneColor, type OneState } from '@mesapop/shared'

/**
 * Bot do One — nível equilibrado. Só olha a própria mão + a carta do topo e a
 * cor ativa. Guarda os curingas, prefere cartas de ação (pular/inverter/+2) e
 * solta números altos; escolhe a cor do curinga pela que tem mais na mão.
 */

const ACTIONS = ['skip', 'rev', '+2', '+4']

function corPreferida(hand: OneCard[]): OneColor {
  const count: Record<OneColor, number> = { r: 0, y: 0, g: 0, b: 0 }
  for (const c of hand) if (c.c !== 'w') count[c.c]++
  return (Object.keys(count) as OneColor[]).reduce((a, b) => (count[b] > count[a] ? b : a), 'r')
}

function rank(c: OneCard): number {
  let s = 0
  if (ACTIONS.includes(c.v)) s += 20
  if (c.c === 'w') s -= 5 // guarda o curinga
  const n = Number(c.v)
  if (!Number.isNaN(n)) s += n
  return s
}

export function chooseOneAction(state: OneState, seat: number): OneAction | null {
  if (state.winnerSeats.length) return null
  if (state.turn !== seat) return null

  const hand = state.hands[seat] ?? []

  // carta recém-comprada jogável → joga (reduz a mão)
  if (state.drawnPlayable) {
    const card = state.drawnPlayable
    return card.c === 'w'
      ? { type: 'play', card, chooseColor: corPreferida(hand) }
      : { type: 'play', card }
  }

  const playable = hand.filter((c) => canPlayCard(state, c))
  if (playable.length === 0) return { type: 'draw' }

  // guarda curingas: só usa se não houver carta de cor/número
  const naoCuringa = playable.filter((c) => c.c !== 'w')
  const pool = naoCuringa.length ? naoCuringa : playable

  let bestVal = -Infinity
  let best: OneCard[] = []
  for (const c of pool) {
    const v = rank(c)
    if (v > bestVal) {
      bestVal = v
      best = [c]
    } else if (v === bestVal) {
      best.push(c)
    }
  }
  const pick = best[Math.floor(Math.random() * best.length)]!
  return pick.c === 'w'
    ? { type: 'play', card: pick, chooseColor: corPreferida(hand) }
    : { type: 'play', card: pick }
}
