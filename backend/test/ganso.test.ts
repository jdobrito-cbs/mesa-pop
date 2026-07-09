import { describe, expect, it } from 'vitest'
import { aplicaRolagem, casaInfo, GANSO_FIM, initialGansoState, type GansoState } from '@mesapop/shared'

/** aplica um lance com dados fixos e devolve o novo estado (ou lança) */
function rola(s: GansoState, seat: number, d1: number, d2: number): GansoState {
  const r = aplicaRolagem(s, seat, [d1, d2])
  if ('error' in r) throw new Error(r.error)
  return r.state
}

describe('Corrida do Ganso', () => {
  it('move pela soma dos dados e passa a vez', () => {
    const s = rola(initialGansoState(2), 0, 2, 1) // 3 casas → posição 3 (normal)
    expect(s.positions[0]).toBe(3)
    expect(s.turn).toBe(1)
  })

  it('só o jogador da vez joga', () => {
    const r = aplicaRolagem(initialGansoState(2), 1, [3, 3])
    expect('error' in r).toBe(true)
  })

  it('ganso faz avançar de novo o mesmo valor', () => {
    // casa 5 é ganso: sair de 0 com roll 5 → cai em 5 → +5 → 10
    const s = rola(initialGansoState(2), 0, 4, 1)
    expect(s.positions[0]).toBe(10)
    expect(s.lastMove?.eventos).toContain('ganso')
  })

  it('ponte (6) leva para 12', () => {
    const s = rola(initialGansoState(2), 0, 5, 1) // 0+6 = 6 = ponte → 12
    expect(s.positions[0]).toBe(12)
    expect(s.lastMove?.eventos).toContain('ponte')
  })

  it('poço (31) faz perder 2 vezes', () => {
    // leva o assento 0 até 25 e então tira 6 → 31 (poço)
    let s = initialGansoState(2)
    s = { ...s, positions: [25, 0], turn: 0 }
    s = rola(s, 0, 3, 3) // 25+6 = 31
    expect(s.positions[0]).toBe(31)
    expect(s.skip[0]).toBe(2)
    expect(s.lastMove?.eventos).toContain('poco')
  })

  it('caveira (58) volta para a largada', () => {
    let s = initialGansoState(2)
    s = { ...s, positions: [52, 0], turn: 0 }
    s = rola(s, 0, 3, 3) // 52+6 = 58 = caveira → 0
    expect(s.positions[0]).toBe(0)
    expect(s.lastMove?.eventos).toContain('caveira')
  })

  it('passar de 63 ricocheteia; chegar EXATO vence', () => {
    let s = initialGansoState(2)
    s = { ...s, positions: [60, 0], turn: 0 }
    const ric = rola(s, 0, 4, 2) // 60+6 = 66 → ricochete 63-3 = 60
    expect(ric.positions[0]).toBe(60)
    expect(ric.winner).toBeNull()

    s = { ...s, positions: [60, 0], turn: 0 }
    const vit = rola(s, 0, 2, 1) // 60+3 = 63 exato
    expect(vit.positions[0]).toBe(GANSO_FIM)
    expect(vit.winner).toBe(0)
  })

  it('quem está de castigo perde a vez (skip consumido)', () => {
    // assento 1 com 1 castigo: após o 0 jogar, a vez volta ao 0 (pulou o 1)
    let s = initialGansoState(2)
    s = { ...s, skip: [0, 1], turn: 0 }
    s = rola(s, 0, 1, 1) // 0 joga; próximo seria 1, mas está de castigo
    expect(s.turn).toBe(0)
    expect(s.skip[1]).toBe(0) // castigo consumido
  })

  it('casaInfo classifica as casas especiais', () => {
    expect(casaInfo(63).tipo).toBe('fim')
    expect(casaInfo(6).tipo).toBe('ponte')
    expect(casaInfo(31).tipo).toBe('poco')
    expect(casaInfo(58).tipo).toBe('caveira')
    expect(casaInfo(5).tipo).toBe('ganso')
    expect(casaInfo(3).tipo).toBe('normal')
  })
})
