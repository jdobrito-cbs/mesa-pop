/**
 * Dominó (4 jogadores, em duplas) — lógica pura e compartilhada.
 *
 * Regras:
 * - Conjunto duplo-seis (28 peças), 7 para cada jogador — sem monte.
 * - Duplas: assentos 0+2 contra 1+3.
 * - Começa quem tem o [6|6], obrigatoriamente jogando-o.
 * - Joga-se em uma das duas pontas da linha; sem peça válida, passa.
 * - Vitória: primeiro a esvaziar a mão ganha para a dupla.
 * - Trancado (4 passes seguidos): dupla com MENOS pontos na mão vence;
 *   empate em pontos = empate.
 *
 * A mão dos outros NUNCA é enviada ao cliente: `visibleStateFor` reduz o
 * estado à visão de um assento.
 */

export type DominoTile = [number, number]

export interface DominoState {
  hands: DominoTile[][]
  /** linha orientada: line[i][1] encosta em line[i+1][0] */
  line: DominoTile[]
  turn: number
  /** true até o [6|6] ser jogado */
  awaitingOpener: boolean
  consecutivePasses: number
  /** assentos vencedores (dupla) ou vazio */
  winnerSeats: number[]
  draw: boolean
  /** última ação, para feedback na UI */
  lastAction: { seat: number; type: 'play' | 'pass' } | null
}

export type DominoAction =
  | { type: 'play'; tile: DominoTile; side: 'left' | 'right' }
  | { type: 'pass' }

/** Visão de um assento: própria mão + contagem dos demais. */
export interface DominoView {
  yourHand: DominoTile[]
  handCounts: number[]
  line: DominoTile[]
  turn: number
  awaitingOpener: boolean
  winnerSeats: number[]
  draw: boolean
  lastAction: DominoState['lastAction']
  /** pontas abertas [esquerda, direita] ou null antes da 1ª peça */
  ends: [number, number] | null
}

export const DOMINO_PLAYERS = 4

export function allTiles(): DominoTile[] {
  const tiles: DominoTile[] = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b])
  return tiles
}

export function initialDominoState(rng: () => number = Math.random): DominoState {
  const tiles = allTiles()
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }
  const hands = [0, 1, 2, 3].map((p) => tiles.slice(p * 7, p * 7 + 7))
  // com as 28 peças distribuídas, o [6|6] sempre está com alguém
  const opener = hands.findIndex((h) => h.some(([a, b]) => a === 6 && b === 6))
  return {
    hands,
    line: [],
    turn: opener,
    awaitingOpener: true,
    consecutivePasses: 0,
    winnerSeats: [],
    draw: false,
    lastAction: null,
  }
}

export function dominoEnds(state: Pick<DominoState, 'line'>): [number, number] | null {
  if (state.line.length === 0) return null
  return [state.line[0]![0], state.line[state.line.length - 1]![1]]
}

const sameTile = (a: DominoTile, b: DominoTile) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])

/** Lados em que a peça encaixa (vazio = não joga). */
export function playableSides(state: DominoState, tile: DominoTile): Array<'left' | 'right'> {
  if (state.awaitingOpener) {
    return tile[0] === 6 && tile[1] === 6 ? ['left'] : []
  }
  const ends = dominoEnds(state)!
  const sides: Array<'left' | 'right'> = []
  if (tile[0] === ends[0] || tile[1] === ends[0]) sides.push('left')
  if (tile[0] === ends[1] || tile[1] === ends[1]) sides.push('right')
  return sides
}

export function handCanPlay(state: DominoState, seat: number): boolean {
  return state.hands[seat]!.some((t) => playableSides(state, t).length > 0)
}

function teamPips(state: DominoState, team: 0 | 1): number {
  return state.hands.reduce(
    (sum, hand, seat) =>
      seat % 2 === team ? sum + hand.reduce((s, [a, b]) => s + a + b, 0) : sum,
    0,
  )
}

export function applyDominoAction(
  state: DominoState,
  seat: number,
  action: DominoAction,
): { error: string } | { state: DominoState } {
  if (state.winnerSeats.length || state.draw) return { error: 'A partida já terminou' }
  if (state.turn !== seat) return { error: 'Não é a sua vez' }

  if (action.type === 'pass') {
    if (handCanPlay(state, seat)) return { error: 'Você tem peça para jogar' }
    const next: DominoState = {
      ...state,
      consecutivePasses: state.consecutivePasses + 1,
      turn: (seat + 1) % DOMINO_PLAYERS,
      lastAction: { seat, type: 'pass' },
    }
    if (next.consecutivePasses >= DOMINO_PLAYERS) {
      // trancado: menos pontos vence
      const pips0 = teamPips(next, 0)
      const pips1 = teamPips(next, 1)
      if (pips0 === pips1) return { state: { ...next, draw: true } }
      const winnerTeam = pips0 < pips1 ? 0 : 1
      return { state: { ...next, winnerSeats: [winnerTeam, winnerTeam + 2] } }
    }
    return { state: next }
  }

  const hand = state.hands[seat]!
  const inHand = hand.find((t) => sameTile(t, action.tile))
  if (!inHand) return { error: 'Essa peça não está na sua mão' }

  const sides = playableSides(state, inHand)
  if (!sides.includes(action.side)) {
    return { error: state.awaitingOpener ? 'A partida abre com o [6|6]' : 'Essa peça não encaixa aí' }
  }

  // orienta a peça para o lado escolhido
  const ends = dominoEnds(state)
  let oriented: DominoTile
  let line: DominoTile[]
  if (!ends) {
    oriented = [inHand[0], inHand[1]]
    line = [oriented]
  } else if (action.side === 'left') {
    oriented = inHand[1] === ends[0] ? [inHand[0], inHand[1]] : [inHand[1], inHand[0]]
    line = [oriented, ...state.line]
  } else {
    oriented = inHand[0] === ends[1] ? [inHand[0], inHand[1]] : [inHand[1], inHand[0]]
    line = [...state.line, oriented]
  }

  const hands = state.hands.map((h, i) =>
    i === seat ? h.filter((t) => !sameTile(t, inHand)) : h,
  )

  const next: DominoState = {
    ...state,
    hands,
    line,
    awaitingOpener: false,
    consecutivePasses: 0,
    turn: (seat + 1) % DOMINO_PLAYERS,
    lastAction: { seat, type: 'play' },
  }

  if (hands[seat]!.length === 0) {
    const team = (seat % 2) as 0 | 1
    return { state: { ...next, winnerSeats: [team, team + 2] } }
  }
  return { state: next }
}

/** A visão segura de um assento — é ISSO que trafega para o cliente. */
export function dominoViewFor(state: DominoState, seat: number): DominoView {
  return {
    yourHand: state.hands[seat] ?? [],
    handCounts: state.hands.map((h) => h.length),
    line: state.line,
    turn: state.turn,
    awaitingOpener: state.awaitingOpener,
    winnerSeats: state.winnerSeats,
    draw: state.draw,
    lastAction: state.lastAction,
    ends: dominoEnds(state),
  }
}
