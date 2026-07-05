/**
 * One (2–4 jogadores) — lógica pura e compartilhada. Nome e arte genéricos.
 *
 * Baralho (108): 4 cores × { 0×1, 1–9×2, pular×2, inverter×2, +2×2 }
 * + 4 curingas + 4 curingas +4.
 *
 * Regras (v1):
 * - Combina por cor OU símbolo/número; curinga sempre pode.
 * - pular: próximo perde a vez. inverter: muda direção (com 2, age como pular).
 * - +2 / +4: próximo compra e perde a vez (sem acumular).
 * - Sem carta válida: compra 1; se a comprada servir, PODE jogá-la na hora.
 * - Vence quem zerar a mão.
 *
 * A mão dos outros NUNCA é enviada: `oneViewFor` reduz à visão do assento.
 */

export type OneColor = 'r' | 'y' | 'g' | 'b'
export type OneValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'rev' | '+2' | 'wild' | '+4'

export interface OneCard {
  c: OneColor | 'w'
  v: OneValue
}

export interface OneState {
  hands: OneCard[][]
  drawPile: OneCard[]
  discard: OneCard[]
  /** cor ativa (após curinga pode diferir do topo) */
  color: OneColor
  turn: number
  direction: 1 | -1
  players: number
  /** carta recém-comprada que o jogador pode jogar (índice na mão) ou null */
  drawnPlayable: OneCard | null
  winnerSeats: number[]
  lastAction: { seat: number; type: 'play' | 'draw' | 'keep'; card?: OneCard } | null
}

export type OneAction =
  | { type: 'play'; card: OneCard; chooseColor?: OneColor }
  | { type: 'draw' }
  /** guarda a carta comprada e passa a vez */
  | { type: 'keep' }

export interface OneView {
  yourHand: OneCard[]
  handCounts: number[]
  top: OneCard
  color: OneColor
  turn: number
  direction: 1 | -1
  players: number
  drawPileCount: number
  drawnPlayable: OneCard | null
  winnerSeats: number[]
  lastAction: OneState['lastAction']
}

const COLORS: OneColor[] = ['r', 'y', 'g', 'b']

export function buildOneDeck(): OneCard[] {
  const deck: OneCard[] = []
  for (const c of COLORS) {
    deck.push({ c, v: '0' })
    for (let n = 1; n <= 9; n++) {
      deck.push({ c, v: String(n) as OneValue }, { c, v: String(n) as OneValue })
    }
    for (const v of ['skip', 'rev', '+2'] as OneValue[]) {
      deck.push({ c, v }, { c, v })
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ c: 'w', v: 'wild' }, { c: 'w', v: '+4' })
  return deck
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function initialOneState(players: number, rng: () => number = Math.random): OneState {
  const deck = shuffle(buildOneDeck(), rng)
  const hands = Array.from({ length: players }, (_, p) => deck.slice(p * 7, p * 7 + 7))
  let rest = deck.slice(players * 7)
  // vira o topo: precisa ser carta numérica
  let topIdx = rest.findIndex((card) => card.c !== 'w' && !['skip', 'rev', '+2'].includes(card.v))
  if (topIdx < 0) topIdx = 0
  const top = rest[topIdx]!
  rest = rest.filter((_, i) => i !== topIdx)
  return {
    hands,
    drawPile: rest,
    discard: [top],
    color: top.c as OneColor,
    turn: 0,
    direction: 1,
    players,
    drawnPlayable: null,
    winnerSeats: [],
    lastAction: null,
  }
}

export function topCard(state: OneState): OneCard {
  return state.discard[state.discard.length - 1]!
}

export function canPlayCard(state: OneState, card: OneCard): boolean {
  if (card.c === 'w') return true
  return card.c === state.color || card.v === topCard(state).v
}

/** Mesma checagem, mas sobre a VISÃO do cliente (sem o descarte completo). */
export function canPlayOnView(
  view: Pick<OneView, 'color' | 'top'>,
  card: OneCard,
): boolean {
  if (card.c === 'w') return true
  return card.c === view.color || card.v === view.top.v
}

const sameCard = (a: OneCard, b: OneCard) => a.c === b.c && a.v === b.v

function nextSeat(state: OneState, from: number, steps = 1): number {
  return (from + state.direction * steps + state.players * steps) % state.players
}

/** compra N do monte, reembaralhando o descarte (menos o topo) se preciso */
function drawCards(state: OneState, seat: number, n: number, rng: () => number): OneState {
  let { drawPile, discard } = state
  const hand = state.hands[seat]!.slice()
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discard.length <= 1) break // sem cartas no jogo: ignora
      const top = discard[discard.length - 1]!
      drawPile = shuffle(discard.slice(0, -1), rng)
      discard = [top]
    }
    hand.push(drawPile[0]!)
    drawPile = drawPile.slice(1)
  }
  return {
    ...state,
    drawPile,
    discard,
    hands: state.hands.map((h, i) => (i === seat ? hand : h)),
  }
}

export function applyOneAction(
  state: OneState,
  seat: number,
  action: OneAction,
  rng: () => number = Math.random,
): { error: string } | { state: OneState } {
  if (state.winnerSeats.length) return { error: 'A partida já terminou' }
  if (state.turn !== seat) return { error: 'Não é a sua vez' }

  if (action.type === 'draw') {
    if (state.drawnPlayable) return { error: 'Decida sobre a carta comprada' }
    if (state.hands[seat]!.some((card) => canPlayCard(state, card))) {
      return { error: 'Você tem carta para jogar' }
    }
    const afterDraw = drawCards(state, seat, 1, rng)
    const drawn = afterDraw.hands[seat]![afterDraw.hands[seat]!.length - 1] ?? null
    if (drawn && canPlayCard(afterDraw, drawn)) {
      // pode jogar a comprada agora (ou guardar)
      return {
        state: { ...afterDraw, drawnPlayable: drawn, lastAction: { seat, type: 'draw' } },
      }
    }
    return {
      state: {
        ...afterDraw,
        turn: nextSeat(afterDraw, seat),
        drawnPlayable: null,
        lastAction: { seat, type: 'draw' },
      },
    }
  }

  if (action.type === 'keep') {
    if (!state.drawnPlayable) return { error: 'Nada para guardar' }
    return {
      state: {
        ...state,
        drawnPlayable: null,
        turn: nextSeat(state, seat),
        lastAction: { seat, type: 'keep' },
      },
    }
  }

  // play
  const hand = state.hands[seat]!
  const card = hand.find((c) => sameCard(c, action.card))
  if (!card) return { error: 'Essa carta não está na sua mão' }
  if (state.drawnPlayable && !sameCard(card, state.drawnPlayable)) {
    return { error: 'Agora só vale a carta comprada (ou guarde-a)' }
  }
  if (!canPlayCard(state, card)) return { error: 'Essa carta não combina' }
  if (card.c === 'w' && !action.chooseColor) return { error: 'Escolha a cor do curinga' }

  // remove UMA ocorrência
  const idx = hand.findIndex((c) => sameCard(c, card))
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((_, j) => j !== idx) : h))

  let next: OneState = {
    ...state,
    hands,
    discard: [...state.discard, card],
    color: card.c === 'w' ? action.chooseColor! : card.c,
    drawnPlayable: null,
    lastAction: { seat, type: 'play', card },
  }

  if (hands[seat]!.length === 0) {
    return { state: { ...next, winnerSeats: [seat] } }
  }

  // efeitos
  if (card.v === 'skip' || (card.v === 'rev' && state.players === 2)) {
    next = { ...next, turn: nextSeat(next, seat, 2) }
  } else if (card.v === 'rev') {
    const direction = (next.direction * -1) as 1 | -1
    next = { ...next, direction, turn: nextSeat({ ...next, direction }, seat) }
  } else if (card.v === '+2' || card.v === '+4') {
    const victim = nextSeat(next, seat)
    next = drawCards(next, victim, card.v === '+2' ? 2 : 4, rng)
    next = { ...next, turn: nextSeat(next, seat, 2) }
  } else {
    next = { ...next, turn: nextSeat(next, seat) }
  }
  return { state: next }
}

/** A visão segura de um assento — é ISSO que trafega para o cliente. */
export function oneViewFor(state: OneState, seat: number): OneView {
  return {
    yourHand: state.hands[seat] ?? [],
    handCounts: state.hands.map((h) => h.length),
    top: topCard(state),
    color: state.color,
    turn: state.turn,
    direction: state.direction,
    players: state.players,
    drawPileCount: state.drawPile.length,
    drawnPlayable: state.turn === seat ? state.drawnPlayable : null,
    winnerSeats: state.winnerSeats,
    lastAction: state.lastAction,
  }
}
