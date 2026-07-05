/**
 * Dominó (4 jogadores, em duplas) — regras profissionais "All Fives"
 * (Muggins), ref.: play-domino-online.com/pt/regras-de-domino/.
 *
 * - Conjunto duplo-seis (28 peças), 7 por jogador — sem monte.
 * - Duplas: assentos 0+2 contra 1+3.
 * - Abre quem tem o [6|6], obrigatoriamente jogando-o. Ele é o SPINNER:
 *   o jogo cresce nas 4 direções a partir dele. Os braços de cima/baixo
 *   só abrem depois que os dois braços laterais existirem.
 * - PONTUAÇÃO PELAS PONTAS ABERTAS (única fonte de pontos): após cada
 *   jogada, se a soma das pontas externas for múltiplo de 5, a dupla marca
 *   essa soma. Carroça na ponta conta as duas metades; o spinner conta 12
 *   até os dois lados laterais serem cobertos.
 * - Fim de mão (alguém bate, ou tranca com 4 passes): vence a partida a
 *   dupla que PONTUOU MAIS — sem somar as mãos adversárias. Empate em
 *   pontos → nova mão (placar mantido) até desempatar.
 *
 * A mão dos outros NUNCA é enviada ao cliente (`dominoViewFor`).
 */

export type DominoTile = [number, number]

/** braços a partir do spinner: 0=direita, 1=esquerda, 2=cima, 3=baixo */
export type ArmIndex = 0 | 1 | 2 | 3

export interface HandResult {
  /** 'bate' | 'trancado' */
  kind: 'bate' | 'trancado'
  /** dupla vencedora pelo placar (0|1) ou null (empate → nova mão) */
  team: 0 | 1 | null
  /** placar no momento do fim da mão */
  scores: [number, number]
  /** assento que bateu (se bate) */
  seat: number | null
}

export interface DominoState {
  hands: DominoTile[][]
  /** o [6|6] quando jogado */
  spinner: DominoTile | null
  /** peças de cada braço, da mais interna para a mais externa, orientadas [interno, externo] */
  arms: [DominoTile[], DominoTile[], DominoTile[], DominoTile[]]
  turn: number
  awaitingOpener: boolean
  consecutivePasses: number
  /** placar acumulado das duplas [dupla0, dupla1] */
  scores: [number, number]
  handNumber: number
  /** pontos marcados na última jogada (para a UI comemorar) */
  lastMoveScore: { seat: number; points: number } | null
  /** resultado da última mão encerrada (para a UI mostrar entre mãos) */
  lastHandResult: HandResult | null
  lastAction: { seat: number; type: 'play' | 'pass' } | null
  winnerSeats: number[]
  draw: boolean
}

export type DominoAction =
  | { type: 'play'; tile: DominoTile; side: ArmIndex }
  | { type: 'pass' }

export interface DominoView {
  yourHand: DominoTile[]
  handCounts: number[]
  spinner: DominoTile | null
  arms: [DominoTile[], DominoTile[], DominoTile[], DominoTile[]]
  /** valor aberto de cada braço jogável (null = braço fechado no momento) */
  openEnds: (number | null)[]
  endsSum: number
  turn: number
  awaitingOpener: boolean
  scores: [number, number]
  handNumber: number
  lastMoveScore: DominoState['lastMoveScore']
  lastHandResult: HandResult | null
  lastAction: DominoState['lastAction']
  winnerSeats: number[]
  draw: boolean
}

export const DOMINO_PLAYERS = 4

export function allTiles(): DominoTile[] {
  const tiles: DominoTile[] = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b])
  return tiles
}

function dealHands(rng: () => number): DominoTile[][] {
  const tiles = allTiles()
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }
  return [0, 1, 2, 3].map((p) => tiles.slice(p * 7, p * 7 + 7))
}

function openerOf(hands: DominoTile[][]): number {
  return hands.findIndex((h) => h.some(([a, b]) => a === 6 && b === 6))
}

export function initialDominoState(rng: () => number = Math.random): DominoState {
  const hands = dealHands(rng)
  return {
    hands,
    spinner: null,
    arms: [[], [], [], []],
    turn: openerOf(hands),
    awaitingOpener: true,
    consecutivePasses: 0,
    scores: [0, 0],
    handNumber: 1,
    lastMoveScore: null,
    lastHandResult: null,
    lastAction: null,
    winnerSeats: [],
    draw: false,
  }
}

const isDouble = (t: DominoTile) => t[0] === t[1]
const sameTile = (a: DominoTile, b: DominoTile) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
const pips = (t: DominoTile) => t[0] + t[1]

/** os braços laterais (0 e 1) já existem? (condição para abrir cima/baixo) */
function sidesCovered(state: DominoState): boolean {
  return state.arms[0].length > 0 && state.arms[1].length > 0
}

/**
 * Valor aberto de cada braço, ou null se o braço não é jogável agora.
 * Braço vazio jogável casa com o valor do spinner (6).
 */
export function armOpenEnds(state: DominoState): (number | null)[] {
  if (!state.spinner) return [null, null, null, null]
  const spinnerValue = state.spinner[0]
  return ([0, 1, 2, 3] as ArmIndex[]).map((arm) => {
    const tiles = state.arms[arm]
    if (tiles.length > 0) return tiles[tiles.length - 1]![1]
    // braço vazio: laterais sempre abertos; cima/baixo só após os laterais
    if (arm <= 1) return spinnerValue
    return sidesCovered(state) ? spinnerValue : null
  })
}

/**
 * Soma das pontas abertas para pontuação (regra Muggins):
 * - ponta com carroça conta as DUAS metades;
 * - o spinner conta 12 enquanto os dois lados laterais não estiverem cobertos;
 * - braço aberto mas vazio não soma nada (além do spinner, se exposto).
 */
export function endsSum(state: DominoState): number {
  if (!state.spinner) return 0
  let sum = 0
  if (!sidesCovered(state)) sum += pips(state.spinner)
  for (const arm of state.arms) {
    if (arm.length === 0) continue
    const outer = arm[arm.length - 1]!
    sum += isDouble(outer) ? pips(outer) : outer[1]
  }
  return sum
}

/** Braços em que a peça encaixa agora (vazio = não joga). */
export function playableSides(state: DominoState, tile: DominoTile): ArmIndex[] {
  if (state.winnerSeats.length || state.draw) return []
  if (state.awaitingOpener) {
    return tile[0] === 6 && tile[1] === 6 ? [0] : []
  }
  const ends = armOpenEnds(state)
  const sides: ArmIndex[] = []
  for (const arm of [0, 1, 2, 3] as ArmIndex[]) {
    const end = ends[arm]
    if (end === null) continue
    if (tile[0] === end || tile[1] === end) sides.push(arm)
  }
  return sides
}

export function handCanPlay(state: DominoState, seat: number): boolean {
  return state.hands[seat]!.some((t) => playableSides(state, t).length > 0)
}

/**
 * Fim de mão (bate ou trancado): vence a dupla com MAIS pontos no placar
 * — sem somar as mãos adversárias. Empate → nova mão, placar mantido.
 */
function settleHand(
  state: DominoState,
  kind: HandResult['kind'],
  seat: number | null,
  rng: () => number,
): DominoState {
  const scores = state.scores
  const team: 0 | 1 | null = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null
  const result: HandResult = { kind, team, scores: [...scores], seat }

  if (team !== null) {
    return {
      ...state,
      lastHandResult: result,
      winnerSeats: [team, team + 2],
      draw: false,
    }
  }

  // empate em pontos: nova mão para desempatar (quem tem o [6|6] abre)
  const hands = dealHands(rng)
  return {
    ...state,
    hands,
    spinner: null,
    arms: [[], [], [], []],
    turn: openerOf(hands),
    awaitingOpener: true,
    consecutivePasses: 0,
    handNumber: state.handNumber + 1,
    lastMoveScore: null,
    lastHandResult: result,
    lastAction: null,
  }
}

export function applyDominoAction(
  state: DominoState,
  seat: number,
  action: DominoAction,
  rng: () => number = Math.random,
): { error: string } | { state: DominoState } {
  if (state.winnerSeats.length || state.draw) return { error: 'A partida já terminou' }
  if (state.turn !== seat) return { error: 'Não é a sua vez' }

  if (action.type === 'pass') {
    if (handCanPlay(state, seat)) return { error: 'Você tem pedra para jogar' }
    const next: DominoState = {
      ...state,
      consecutivePasses: state.consecutivePasses + 1,
      turn: (seat + 1) % DOMINO_PLAYERS,
      lastMoveScore: null,
      lastAction: { seat, type: 'pass' },
    }
    if (next.consecutivePasses >= DOMINO_PLAYERS) {
      // trancado: vence quem pontuou mais (empate → nova mão)
      return { state: settleHand(next, 'trancado', null, rng) }
    }
    return { state: next }
  }

  const hand = state.hands[seat]!
  const inHand = hand.find((t) => sameTile(t, action.tile))
  if (!inHand) return { error: 'Essa pedra não está na sua mão' }

  const sides = playableSides(state, inHand)
  const side = action.side
  if (side !== 0 && side !== 1 && side !== 2 && side !== 3) return { error: 'Ponta inválida' }
  if (!sides.includes(side)) {
    return {
      error: state.awaitingOpener ? 'A partida abre com o [6|6]' : 'Essa pedra não encaixa aí',
    }
  }

  const hands = state.hands.map((h, i) =>
    i === seat ? h.filter((t) => !sameTile(t, inHand)) : h,
  )

  let next: DominoState
  if (state.awaitingOpener) {
    next = {
      ...state,
      hands,
      spinner: inHand,
      arms: [[], [], [], []],
      awaitingOpener: false,
      consecutivePasses: 0,
      turn: (seat + 1) % DOMINO_PLAYERS,
      lastAction: { seat, type: 'play' },
      lastMoveScore: null,
    }
  } else {
    const ends = armOpenEnds(state)
    const endValue = ends[side]!
    // orienta [interno, externo]
    const oriented: DominoTile = inHand[0] === endValue ? [inHand[0], inHand[1]] : [inHand[1], inHand[0]]
    const arms = state.arms.map((a, i) => (i === side ? [...a, oriented] : a)) as DominoState['arms']
    next = {
      ...state,
      hands,
      arms,
      consecutivePasses: 0,
      turn: (seat + 1) % DOMINO_PLAYERS,
      lastAction: { seat, type: 'play' },
      lastMoveScore: null,
    }
  }

  // pontuação pelas pontas abertas (múltiplos de 5) — única fonte de pontos
  const sum = endsSum(next)
  if (sum > 0 && sum % 5 === 0) {
    const team = (seat % 2) as 0 | 1
    const scores: [number, number] = [...next.scores]
    scores[team] += sum
    next = { ...next, scores, lastMoveScore: { seat, points: sum } }
  }

  // bateu: fim de mão — vence quem pontuou mais (sem somar mãos adversárias)
  if (hands[seat]!.length === 0) {
    return { state: settleHand(next, 'bate', seat, rng) }
  }

  return { state: next }
}

/** A visão segura de um assento — é ISSO que trafega para o cliente. */
export function dominoViewFor(state: DominoState, seat: number): DominoView {
  return {
    yourHand: state.hands[seat] ?? [],
    handCounts: state.hands.map((h) => h.length),
    spinner: state.spinner,
    arms: state.arms,
    openEnds: armOpenEnds(state),
    endsSum: endsSum(state),
    turn: state.turn,
    awaitingOpener: state.awaitingOpener,
    scores: state.scores,
    handNumber: state.handNumber,
    lastMoveScore: state.lastMoveScore,
    lastHandResult: state.lastHandResult,
    lastAction: state.lastAction,
    winnerSeats: state.winnerSeats,
    draw: state.draw,
  }
}
