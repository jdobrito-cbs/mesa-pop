import { describe, expect, it } from 'vitest'
import {
  applyDominoAction,
  dominoEnds,
  dominoViewFor,
  handCanPlay,
  initialDominoState,
  playableSides,
  type DominoState,
  type DominoTile,
} from '@mesapop/shared'

function stateWith(hands: DominoTile[][], overrides: Partial<DominoState> = {}): DominoState {
  return {
    hands,
    line: [],
    turn: 0,
    awaitingOpener: false,
    consecutivePasses: 0,
    winnerSeats: [],
    draw: false,
    lastAction: null,
    ...overrides,
  }
}

describe('distribuição', () => {
  it('28 peças, 7 por jogador, e quem tem o [6|6] começa', () => {
    const s = initialDominoState()
    expect(s.hands.flat()).toHaveLength(28)
    s.hands.forEach((h) => expect(h).toHaveLength(7))
    expect(s.hands[s.turn]!.some(([a, b]) => a === 6 && b === 6)).toBe(true)
    expect(s.awaitingOpener).toBe(true)
  })

  it('a abertura só aceita o [6|6]', () => {
    const s = initialDominoState()
    const opener = s.turn
    const other = s.hands[opener]!.find(([a, b]) => !(a === 6 && b === 6))!
    const bad = applyDominoAction(s, opener, { type: 'play', tile: other, side: 'left' })
    expect('error' in bad && bad.error).toContain('[6|6]')

    const good = applyDominoAction(s, opener, { type: 'play', tile: [6, 6], side: 'left' })
    expect('state' in good).toBe(true)
    if ('state' in good) {
      expect(good.state.line).toEqual([[6, 6]])
      expect(good.state.turn).toBe((opener + 1) % 4)
    }
  })
})

describe('encaixe e orientação', () => {
  it('peça encaixa nas pontas certas e é orientada', () => {
    const s = stateWith(
      [[[2, 5]], [[3, 6]], [[1, 1]], [[0, 0]]],
      { line: [[5, 6]], turn: 0 },
    )
    // ponta esquerda = 5, direita = 6
    expect(playableSides(s, [2, 5])).toEqual(['left'])
    const played = applyDominoAction(s, 0, { type: 'play', tile: [2, 5], side: 'left' })
    if (!('state' in played)) throw new Error('esperava jogar')
    expect(played.state.line).toEqual([
      [2, 5],
      [5, 6],
    ])
    expect(dominoEnds(played.state)).toEqual([2, 6])
  })

  it('peça que não encaixa é recusada', () => {
    const s = stateWith(
      [[[1, 2]], [[3, 6]], [[1, 1]], [[0, 0]]],
      { line: [[5, 6]], turn: 0 },
    )
    const res = applyDominoAction(s, 0, { type: 'play', tile: [1, 2], side: 'right' })
    expect('error' in res).toBe(true)
  })
})

describe('passe', () => {
  it('só passa quem realmente não tem jogada', () => {
    const s = stateWith(
      [[[5, 5]], [[3, 6]], [[1, 1]], [[0, 0]]],
      { line: [[5, 6]], turn: 0 },
    )
    expect(handCanPlay(s, 0)).toBe(true)
    const res = applyDominoAction(s, 0, { type: 'pass' })
    expect('error' in res && res.error).toContain('peça para jogar')
  })

  it('4 passes trancam o jogo e vence a dupla com menos pontos', () => {
    // pontas 0-0: ninguém tem 0 → todos passam
    const s = stateWith(
      [
        [[5, 5]], // seat 0 (dupla A): 10 pontos
        [[1, 1]], // seat 1 (dupla B): 2
        [[6, 6]], // seat 2 (dupla A): 12 → A = 22
        [[1, 2]], // seat 3 (dupla B): 3 → B = 5
      ],
      { line: [[0, 0]], turn: 0 },
    )
    let cur = s
    for (let seat = 0; seat < 4; seat++) {
      const res = applyDominoAction(cur, seat, { type: 'pass' })
      if (!('state' in res)) throw new Error('esperava passar')
      cur = res.state
    }
    expect(cur.winnerSeats.sort()).toEqual([1, 3])
  })
})

describe('vitória', () => {
  it('esvaziar a mão dá vitória à dupla', () => {
    const s = stateWith(
      [[[5, 3]], [[3, 6]], [[1, 1]], [[0, 0]]],
      { line: [[5, 6]], turn: 0 },
    )
    const res = applyDominoAction(s, 0, { type: 'play', tile: [5, 3], side: 'left' })
    if (!('state' in res)) throw new Error('esperava jogar')
    expect(res.state.winnerSeats.sort()).toEqual([0, 2])
  })
})

describe('mão escondida', () => {
  it('a visão de um assento não contém as mãos dos outros', () => {
    const s = initialDominoState()
    const view = dominoViewFor(s, 1)
    expect(view.yourHand).toEqual(s.hands[1])
    expect(view.handCounts).toEqual([7, 7, 7, 7])
    const serialized = JSON.stringify(view)
    // nenhuma peça exclusiva dos outros pode aparecer na visão
    for (const seat of [0, 2, 3]) {
      for (const tile of s.hands[seat]!) {
        const alsoMine = s.hands[1]!.some(
          (t) => (t[0] === tile[0] && t[1] === tile[1]) || (t[0] === tile[1] && t[1] === tile[0]),
        )
        if (!alsoMine) {
          expect(serialized).not.toContain(JSON.stringify(tile))
        }
      }
    }
    expect(serialized).not.toContain('"hands"')
  })
})
