import { describe, expect, it } from 'vitest'
import {
  forcaCarta,
  manilhaRank,
  vencedorMao,
  vencedorVaza,
  type TrucoCard,
} from '@mesapop/shared'
import {
  aplicaTrucoAction,
  initialTrucoState,
  trucoViewFor,
  type TrucoState,
} from '../src/games/truco'

const C = (r: TrucoCard['r'], s: TrucoCard['s']): TrucoCard => ({ r, s })

describe('Truco — força e vazas', () => {
  it('manilha é o rank seguinte à vira; paus é a mais forte', () => {
    expect(manilhaRank(C('4', 'o'))).toBe('5')
    expect(manilhaRank(C('3', 'o'))).toBe('4') // dá a volta
    const vira = C('4', 'o') // manilha = 5
    expect(forcaCarta(C('5', 'p'), vira)).toBeGreaterThan(forcaCarta(C('5', 'c'), vira))
    expect(forcaCarta(C('5', 'o'), vira)).toBeGreaterThan(forcaCarta(C('3', 'p'), vira)) // manilha > 3
    expect(forcaCarta(C('3', 'o'), vira)).toBeGreaterThan(forcaCarta(C('2', 'p'), vira)) // 3 > 2
  })

  it('vaza: maior leva; empate entre TIMES = vaza empachada', () => {
    const vira = C('4', 'o')
    expect(vencedorVaza([{ seat: 0, card: C('3', 'o') }, { seat: 1, card: C('2', 'p') }], vira)).toBe(0)
    // mesmo rank em times opostos = empate
    expect(vencedorVaza([{ seat: 0, card: C('3', 'o') }, { seat: 1, card: C('3', 'p') }], vira)).toBeNull()
    // manilha desempata mesmo rank
    expect(vencedorVaza([{ seat: 0, card: C('5', 'o') }, { seat: 1, card: C('5', 'p') }], vira)).toBe(1)
  })

  it('mão: 2 vazas vencem; empate dá a mão a quem já venceu', () => {
    expect(vencedorMao([0, 0])).toBe(0)
    expect(vencedorMao([0])).toBeUndefined()
    expect(vencedorMao([0, null])).toBe(0) // venceu a 1ª, empatou a 2ª → leva
    expect(vencedorMao([null, 1])).toBe(1) // empatou a 1ª, venceu a 2ª → leva
    expect(vencedorMao([null, null, null])).toBeNull() // tudo empatado: anulada
  })
})

describe('Truco — partida', () => {
  function estado2p(): TrucoState {
    const s = initialTrucoState(2)
    // determinismo: vira 4 de ouros (manilha 5) e mãos conhecidas
    s.vira = C('4', 'o')
    s.maos = [
      [C('3', 'o'), C('2', 'o'), C('7', 'o')],
      [C('5', 'p'), C('4', 'e'), C('6', 'c')],
    ]
    s.turno = 0
    s.pe = 0
    return s
  }

  it('MÃO ESCONDIDA: a mão do rival nunca trafega', () => {
    const s = estado2p()
    const view1 = JSON.stringify(trucoViewFor(s, 1))
    expect(view1).not.toContain('"r":"3"') // carta do seat 0
    expect(trucoViewFor(s, 1).minhaMao).toHaveLength(3)
    expect(trucoViewFor(s, -1).minhaMao).toHaveLength(0) // espectador: nada
    expect(trucoViewFor(s, 0).cartasRestantes).toEqual([3, 3])
  })

  it('vaza joga e a manilha ganha do 3', () => {
    const s = estado2p()
    aplicaTrucoAction(s, 0, { type: 'carta', index: 0 }) // 3 de ouros
    const r = aplicaTrucoAction(s, 1, { type: 'carta', index: 0 }) // 5 de paus (manilha!)
    expect('error' in r).toBe(false)
    expect(s.vazas[0]).toBe(1)
    expect(s.turno).toBe(1) // quem venceu abre a próxima
  })

  it('truco pedido: rival aceita e a mão passa a valer 3', () => {
    const s = estado2p()
    aplicaTrucoAction(s, 0, { type: 'truco' })
    expect(s.fase).toBe('respondendo')
    const errado = aplicaTrucoAction(s, 0, { type: 'aceitar' }) // eu mesmo não respondo
    expect('error' in errado).toBe(true)
    aplicaTrucoAction(s, 1, { type: 'aceitar' })
    expect(s.fase).toBe('jogando')
    expect(s.valor).toBe(3)
    // quem pediu não pode aumentar de novo em seguida
    const denovo = aplicaTrucoAction(s, 0, { type: 'truco' })
    expect('error' in denovo).toBe(true)
  })

  it('correr entrega o valor anterior', () => {
    const s = estado2p()
    aplicaTrucoAction(s, 0, { type: 'truco' })
    aplicaTrucoAction(s, 1, { type: 'correr' })
    expect(s.placar[0]).toBe(1) // valia 1 antes do truco
    expect(s.ultimaMao).toMatchObject({ team: 0, valor: 1, correu: true })
    expect(s.maos[0]).toHaveLength(3) // mão nova já distribuída
  })

  it('aumentar por cima: truco → seis → aceitar vale 6', () => {
    const s = estado2p()
    aplicaTrucoAction(s, 0, { type: 'truco' }) // propõe 3
    aplicaTrucoAction(s, 1, { type: 'truco' }) // aumenta p/ 6
    expect(s.pendente).toMatchObject({ paraTeam: 0, novoValor: 6 })
    aplicaTrucoAction(s, 0, { type: 'aceitar' })
    expect(s.valor).toBe(6)
  })

  it('partida termina aos 12 tentos', () => {
    const s = estado2p()
    s.placar = [11, 0]
    aplicaTrucoAction(s, 0, { type: 'truco' })
    aplicaTrucoAction(s, 1, { type: 'correr' }) // 0 chega a 12
    expect(s.fase).toBe('fim')
    expect(s.vencedores).toEqual([0])
  })
})
