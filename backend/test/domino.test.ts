import { describe, expect, it } from 'vitest'
import {
  applyDominoAction,
  armOpenEnds,
  dominoViewFor,
  endsSum,
  handCanPlay,
  initialDominoState,
  playableSides,
  type DominoState,
  type DominoTile,
} from '@mesapop/shared'

const rng = () => 0.5

function stateWith(
  hands: DominoTile[][],
  overrides: Partial<DominoState> = {},
): DominoState {
  return {
    hands,
    spinner: [6, 6],
    arms: [[], [], [], []],
    turn: 0,
    awaitingOpener: false,
    consecutivePasses: 0,
    scores: [0, 0],
    target: 100,
    handNumber: 1,
    lastMoveScore: null,
    lastHandResult: null,
    lastAction: null,
    winnerSeats: [],
    draw: false,
    ...overrides,
  }
}

describe('distribuição e abertura', () => {
  it('28 peças, 7 por jogador, quem tem o [6|6] abre com ele (spinner)', () => {
    const s = initialDominoState()
    expect(s.hands.flat()).toHaveLength(28)
    expect(s.hands[s.turn]!.some(([a, b]) => a === 6 && b === 6)).toBe(true)
    expect(s.awaitingOpener).toBe(true)

    const other = s.hands[s.turn]!.find(([a, b]) => !(a === 6 && b === 6))!
    const bad = applyDominoAction(s, s.turn, { type: 'play', tile: other, side: 0 }, rng)
    expect('error' in bad && bad.error).toContain('[6|6]')

    const good = applyDominoAction(s, s.turn, { type: 'play', tile: [6, 6], side: 0 }, rng)
    if (!('state' in good)) throw new Error('esperava abrir')
    expect(good.state.spinner).toEqual([6, 6])
  })
})

describe('spinner e os 4 braços', () => {
  it('cima/baixo só abrem depois dos dois braços laterais', () => {
    const s = stateWith([
      [[6, 2], [0, 1]],
      [[6, 3], [0, 2]],
      [[6, 4], [0, 3]],
      [[6, 5], [0, 4]],
    ])
    expect(armOpenEnds(s)).toEqual([6, 6, null, null])

    const r1 = applyDominoAction(s, 0, { type: 'play', tile: [6, 2], side: 0 }, rng)
    if (!('state' in r1)) throw new Error('joga 1')
    expect(armOpenEnds(r1.state)).toEqual([2, 6, null, null])

    const r2 = applyDominoAction(r1.state, 1, { type: 'play', tile: [6, 3], side: 1 }, rng)
    if (!('state' in r2)) throw new Error('joga 2')
    // agora os 4 cantos estão liberados
    expect(armOpenEnds(r2.state)).toEqual([2, 3, 6, 6])
    expect(playableSides(r2.state, [6, 4])).toEqual([2, 3])
  })
})

describe('pontuação pelas pontas abertas (All Fives)', () => {
  it('spinner conta 12 até cobrir os dois lados; [6|4] faz 12+4=16 (não pontua)', () => {
    const s = stateWith([
      [[6, 4], [0, 1]],
      [[1, 2]],
      [[1, 3]],
      [[1, 4]],
    ])
    const r = applyDominoAction(s, 0, { type: 'play', tile: [6, 4], side: 0 }, rng)
    if (!('state' in r)) throw new Error('joga')
    expect(endsSum(r.state)).toBe(16)
    expect(r.state.lastMoveScore).toBeNull()
  })

  it('pontas 2 e 3 = 5 → dupla marca 5', () => {
    const s = stateWith(
      [
        [[6, 2], [0, 1]],
        [[6, 3], [0, 2]],
        [[1, 3]],
        [[1, 4]],
      ],
      { arms: [[], [], [], []] },
    )
    const r1 = applyDominoAction(s, 0, { type: 'play', tile: [6, 2], side: 0 }, rng)
    if (!('state' in r1)) throw new Error('j1')
    const r2 = applyDominoAction(r1.state, 1, { type: 'play', tile: [6, 3], side: 1 }, rng)
    if (!('state' in r2)) throw new Error('j2')
    // pontas: 2 + 3 = 5 → dupla 1 (assento 1) marca 5
    expect(r2.state.lastMoveScore).toEqual({ seat: 1, points: 5 })
    expect(r2.state.scores).toEqual([0, 5])
  })

  it('carroça na ponta conta as duas metades', () => {
    // arms[0] termina em [x,5]; jogar [5,5] → ponta vale 10
    const s = stateWith(
      [
        [[5, 5], [0, 1]],
        [[1, 2]],
        [[1, 3]],
        [[1, 4]],
      ],
      { arms: [[[6, 5]], [[6, 0]], [], []] },
    )
    // pontas antes: 5 + 0 = 5... jogar a carroça: 10 + 0 = 10 → marca 10
    const r = applyDominoAction(s, 0, { type: 'play', tile: [5, 5], side: 0 }, rng)
    if (!('state' in r)) throw new Error('joga')
    expect(endsSum(r.state)).toBe(10)
    expect(r.state.lastMoveScore).toEqual({ seat: 0, points: 10 })
  })
})

describe('mãos múltiplas até o alvo', () => {
  it('bater leva os pontos das mãos adversárias e redistribui se não atingiu o alvo', () => {
    const s = stateWith(
      [
        [[2, 3]], // seat 0 bate com esta
        [[6, 6], [1, 1]], // 14 pontos
        [[0, 1]],
        [[4, 4]], // 8 pontos
      ],
      { arms: [[[6, 2]], [[6, 0]], [], []], scores: [0, 0], target: 100 },
    )
    const r = applyDominoAction(s, 0, { type: 'play', tile: [2, 3], side: 0 }, rng)
    if (!('state' in r)) throw new Error('bate')
    // dupla 0 leva 14 + 8 = 22; nova mão distribuída
    expect(r.state.scores[0]).toBe(22)
    expect(r.state.handNumber).toBe(2)
    expect(r.state.awaitingOpener).toBe(true)
    expect(r.state.hands.flat()).toHaveLength(28)
    expect(r.state.lastHandResult).toEqual({ kind: 'bate', team: 0, points: 22, seat: 0 })
    expect(r.state.winnerSeats).toEqual([])
  })

  it('atingir o alvo fecha a partida para a dupla', () => {
    const s = stateWith(
      [[[2, 3]], [[6, 6]], [[0, 1]], [[4, 4]]],
      { arms: [[[6, 2]], [[6, 0]], [], []], scores: [90, 0], target: 100 },
    )
    const r = applyDominoAction(s, 0, { type: 'play', tile: [2, 3], side: 0 }, rng)
    if (!('state' in r)) throw new Error('bate')
    expect(r.state.winnerSeats.sort()).toEqual([0, 2])
  })

  it('trancado: dupla com menos pontos leva os pontos da outra', () => {
    const s = stateWith(
      [
        [[5, 5]], // dupla 0: 10
        [[1, 1]], // dupla 1: 2
        [[4, 4]], // dupla 0: +8 → 18
        [[1, 2]], // dupla 1: +3 → 5
      ],
      { arms: [[[6, 0]], [[6, 0]], [], []], turn: 0 },
    )
    let cur = s
    for (let seat = 0; seat < 4; seat++) {
      expect(handCanPlay(cur, seat)).toBe(false)
      const res = applyDominoAction(cur, seat, { type: 'pass' }, rng)
      if (!('state' in res)) throw new Error('passa')
      cur = res.state
    }
    expect(cur.lastHandResult).toEqual({ kind: 'trancado', team: 1, points: 18, seat: null })
    expect(cur.scores).toEqual([0, 18])
    expect(cur.handNumber).toBe(2)
  })
})

describe('validações', () => {
  it('só passa quem não tem jogada', () => {
    const s = stateWith([[[2, 5]], [[1, 1]], [[1, 3]], [[1, 4]]], {
      arms: [[[6, 2]], [], [], []],
    })
    expect(handCanPlay(s, 0)).toBe(true)
    const res = applyDominoAction(s, 0, { type: 'pass' }, rng)
    expect('error' in res && res.error).toContain('pedra para jogar')
  })

  it('pedra que não encaixa é recusada', () => {
    const s = stateWith([[[1, 3]], [[1, 1]], [[1, 4]], [[1, 5]]], {
      arms: [[[6, 2]], [[6, 0]], [], []],
    })
    const res = applyDominoAction(s, 0, { type: 'play', tile: [1, 3], side: 0 }, rng)
    expect('error' in res).toBe(true)
  })
})

describe('mão escondida', () => {
  it('a visão de um assento não contém as mãos dos outros', () => {
    const s = initialDominoState()
    const view = dominoViewFor(s, 1)
    expect(view.yourHand).toEqual(s.hands[1])
    expect(view.handCounts).toEqual([7, 7, 7, 7])
    expect(JSON.stringify(view)).not.toContain('"hands"')
    // espectador (assento -1): mão vazia
    expect(dominoViewFor(s, -1).yourHand).toEqual([])
  })
})
