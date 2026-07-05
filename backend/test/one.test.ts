import { describe, expect, it } from 'vitest'
import {
  applyOneAction,
  buildOneDeck,
  canPlayCard,
  initialOneState,
  oneViewFor,
  topCard,
  type OneCard,
  type OneState,
} from '@mesapop/shared'

const rng = () => 0.42 // determinístico o bastante para os testes

function stateWith(
  hands: OneCard[][],
  top: OneCard,
  overrides: Partial<OneState> = {},
): OneState {
  return {
    hands,
    drawPile: [
      { c: 'r', v: '9' },
      { c: 'g', v: '3' },
      { c: 'b', v: '1' },
      { c: 'y', v: '4' },
      { c: 'r', v: '2' },
      { c: 'g', v: '8' },
    ],
    discard: [top],
    color: top.c === 'w' ? 'r' : top.c,
    turn: 0,
    direction: 1,
    players: hands.length,
    drawnPlayable: null,
    winnerSeats: [],
    lastAction: null,
    ...overrides,
  }
}

describe('baralho e distribuição', () => {
  it('tem 108 cartas', () => {
    expect(buildOneDeck()).toHaveLength(108)
  })
  it('7 por jogador e topo numérico', () => {
    const s = initialOneState(4)
    s.hands.forEach((h) => expect(h).toHaveLength(7))
    expect(['skip', 'rev', '+2', 'wild', '+4']).not.toContain(topCard(s).v)
  })
})

describe('combinações', () => {
  const top: OneCard = { c: 'r', v: '5' }
  it('combina por cor, por número e curinga', () => {
    const s = stateWith([[], []], top)
    expect(canPlayCard(s, { c: 'r', v: '8' })).toBe(true)
    expect(canPlayCard(s, { c: 'b', v: '5' })).toBe(true)
    expect(canPlayCard(s, { c: 'w', v: 'wild' })).toBe(true)
    expect(canPlayCard(s, { c: 'b', v: '8' })).toBe(false)
  })
  it('após curinga, vale a cor escolhida', () => {
    const s = stateWith([[{ c: 'w', v: 'wild' }, { c: 'b', v: '2' }], [{ c: 'r', v: '1' }]], top)
    const r1 = applyOneAction(s, 0, { type: 'play', card: { c: 'w', v: 'wild' }, chooseColor: 'b' }, rng)
    if (!('state' in r1)) throw new Error('esperava jogar')
    expect(r1.state.color).toBe('b')
    expect(canPlayCard(r1.state, { c: 'b', v: '9' })).toBe(true)
    expect(canPlayCard(r1.state, { c: 'r', v: '9' })).toBe(false)
  })
  it('curinga sem escolher cor é recusado', () => {
    const s = stateWith([[{ c: 'w', v: 'wild' }], []], top)
    const res = applyOneAction(s, 0, { type: 'play', card: { c: 'w', v: 'wild' } }, rng)
    expect('error' in res).toBe(true)
  })
})

describe('efeitos', () => {
  const top: OneCard = { c: 'r', v: '5' }
  it('pular avança dois assentos', () => {
    const s = stateWith([[{ c: 'r', v: 'skip' }, { c: 'b', v: '1' }], [], [], []], top)
    const res = applyOneAction(s, 0, { type: 'play', card: { c: 'r', v: 'skip' } }, rng)
    if (!('state' in res)) throw new Error('esperava jogar')
    expect(res.state.turn).toBe(2)
  })
  it('inverter muda a direção (e vira pular com 2 jogadores)', () => {
    const s4 = stateWith([[{ c: 'r', v: 'rev' }, { c: 'b', v: '1' }], [], [], []], top)
    const r4 = applyOneAction(s4, 0, { type: 'play', card: { c: 'r', v: 'rev' } }, rng)
    if (!('state' in r4)) throw new Error('esperava jogar')
    expect(r4.state.direction).toBe(-1)
    expect(r4.state.turn).toBe(3)

    const s2 = stateWith([[{ c: 'r', v: 'rev' }, { c: 'b', v: '1' }], []], top)
    const r2 = applyOneAction(s2, 0, { type: 'play', card: { c: 'r', v: 'rev' } }, rng)
    if (!('state' in r2)) throw new Error('esperava jogar')
    expect(r2.state.turn).toBe(0) // agiu como pular
  })
  it('+2 faz o próximo comprar 2 e perder a vez', () => {
    const s = stateWith([[{ c: 'r', v: '+2' }, { c: 'b', v: '1' }], [{ c: 'g', v: '1' }], [], []], top)
    const res = applyOneAction(s, 0, { type: 'play', card: { c: 'r', v: '+2' } }, rng)
    if (!('state' in res)) throw new Error('esperava jogar')
    expect(res.state.hands[1]).toHaveLength(3)
    expect(res.state.turn).toBe(2)
  })
})

describe('compra', () => {
  const top: OneCard = { c: 'r', v: '5' }
  it('só compra quem não tem jogada', () => {
    const s = stateWith([[{ c: 'r', v: '1' }], []], top)
    const res = applyOneAction(s, 0, { type: 'draw' }, rng)
    expect('error' in res && res.error).toContain('carta para jogar')
  })
  it('comprada jogável pode ser jogada na hora — ou guardada', () => {
    // monte com carta vermelha no topo → jogável
    const s = stateWith([[{ c: 'b', v: '1' }], [{ c: 'g', v: '2' }]], top, {
      drawPile: [{ c: 'r', v: '7' }],
    })
    const drew = applyOneAction(s, 0, { type: 'draw' }, rng)
    if (!('state' in drew)) throw new Error('esperava comprar')
    expect(drew.state.drawnPlayable).toEqual({ c: 'r', v: '7' })
    expect(drew.state.turn).toBe(0) // ainda decide

    // guardar passa a vez
    const kept = applyOneAction(drew.state, 0, { type: 'keep' }, rng)
    if (!('state' in kept)) throw new Error('esperava guardar')
    expect(kept.state.turn).toBe(1)
    expect(kept.state.hands[0]).toHaveLength(2)
  })
  it('comprada não jogável passa a vez direto', () => {
    const s = stateWith([[{ c: 'b', v: '1' }], []], top, { drawPile: [{ c: 'g', v: '2' }] })
    const drew = applyOneAction(s, 0, { type: 'draw' }, rng)
    if (!('state' in drew)) throw new Error('esperava comprar')
    expect(drew.state.drawnPlayable).toBeNull()
    expect(drew.state.turn).toBe(1)
  })
  it('monte vazio reembaralha o descarte (menos o topo)', () => {
    const s = stateWith([[{ c: 'b', v: '1' }], []], top, {
      drawPile: [],
      discard: [{ c: 'g', v: '2' }, { c: 'y', v: '8' }, top],
    })
    const drew = applyOneAction(s, 0, { type: 'draw' }, rng)
    if (!('state' in drew)) throw new Error('esperava comprar')
    expect(drew.state.hands[0]).toHaveLength(2)
    expect(drew.state.discard).toHaveLength(1)
  })
})

describe('vitória e mão escondida', () => {
  it('zerar a mão vence', () => {
    const s = stateWith([[{ c: 'r', v: '1' }], [{ c: 'g', v: '2' }]], { c: 'r', v: '5' })
    const res = applyOneAction(s, 0, { type: 'play', card: { c: 'r', v: '1' } }, rng)
    if (!('state' in res)) throw new Error('esperava jogar')
    expect(res.state.winnerSeats).toEqual([0])
  })

  it('a visão de um assento não contém as mãos dos outros nem o monte', () => {
    const s = initialOneState(4)
    const view = oneViewFor(s, 2)
    expect(view.yourHand).toEqual(s.hands[2])
    expect(view.handCounts).toEqual([7, 7, 7, 7])
    expect(view.drawPileCount).toBe(s.drawPile.length)
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('"hands"')
    expect(serialized).not.toContain('"drawPile"')
    // visão de espectador (assento -1): mão vazia
    const spectator = oneViewFor(s, -1)
    expect(spectator.yourHand).toEqual([])
  })
})
