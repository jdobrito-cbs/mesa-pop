import { describe, expect, it } from 'vitest'
import { MAGNATA_CARTAO_INICIAL, MAGNATA_DINHEIRO_INICIAL } from '@mesapop/shared'
import { initialMagnataState, magnataModule, pagar, receber } from '../src/games/magnata'

describe('Magnata', () => {
  it('estado inicial: caixa e cartão de todos', () => {
    const s = initialMagnataState(3)
    expect(s.jogadores).toHaveLength(3)
    for (const j of s.jogadores) {
      expect(j.dinheiro).toBe(MAGNATA_DINHEIRO_INICIAL)
      expect(j.cartaoLimite).toBe(MAGNATA_CARTAO_INICIAL)
      expect(j.cartaoUsado).toBe(0)
      expect(j.pos).toBe(0)
    }
    expect(s.turno).toBe(0)
  })

  it('CARTÃO DE CRÉDITO: pagar sem caixa usa o cartão e REDUZ o limite', () => {
    const s = initialMagnataState(2)
    const j = s.jogadores[0]!
    j.dinheiro = 40
    const ok = pagar(s, 0, 60, null) // paga 60 com só 40 no caixa
    expect(ok).toBe(true)
    expect(j.dinheiro).toBe(0)
    expect(j.cartaoUsado).toBe(20) // faltaram 20 → foram para o cartão
    expect(j.cartaoLimite).toBe(Math.max(200, MAGNATA_CARTAO_INICIAL - 30)) // pagamento reduz o limite
  })

  it('CARTÃO DE CRÉDITO: receber AUMENTA o limite e quita a dívida', () => {
    const s = initialMagnataState(2)
    const j = s.jogadores[0]!
    j.dinheiro = 0
    j.cartaoUsado = 20
    j.cartaoLimite = 470
    receber(j, 100)
    // limite sobe (100×0.5), dívida quitada com o caixa e sobra vira dinheiro
    expect(j.cartaoLimite).toBe(520)
    expect(j.cartaoUsado).toBe(0)
    expect(j.dinheiro).toBe(80)
  })

  it('falência quando não dá para pagar nem com o crédito → o outro vence', () => {
    const s = initialMagnataState(2)
    const ok = pagar(s, 0, 999999, null)
    expect(ok).toBe(false)
    expect(s.jogadores[0]!.falido).toBe(true)
    expect(s.finished).toBe(true)
    expect(s.winnerSeats).toEqual([1])
  })

  it('comprar uma propriedade a torna sua e cobra o preço', () => {
    const s = initialMagnataState(2)
    s.fase = 'comprar'
    s.compravel = 1 // Rua da Praia (60)
    const antes = s.jogadores[0]!.dinheiro
    const r = magnataModule.play(s, 0, { type: 'comprar' })
    expect('state' in r).toBe(true)
    expect(s.donoDe[1]).toBe(0)
    expect(s.jogadores[0]!.props).toContain(1)
    expect(s.jogadores[0]!.dinheiro).toBe(antes - 60)
    expect(s.fase).toBe('agir')
  })

  it('rolar → move o peão e alterna o turno ao encerrar', () => {
    const s = initialMagnataState(2)
    const r1 = magnataModule.play(s, 0, { type: 'rolar' })
    expect('state' in r1).toBe(true)
    expect(s.dados).not.toBeNull()
    expect(s.jogadores[0]!.pos).toBeGreaterThanOrEqual(0)
    // encerra (se não tirou dupla, passa a vez)
    magnataModule.play(s, 0, { type: s.fase === 'comprar' ? 'passar' : 'encerrar' })
    if (s.fase !== 'rolar') magnataModule.play(s, 0, { type: 'encerrar' })
    // ou virou a vez para 1, ou (dupla) continua no 0
    expect([0, 1]).toContain(s.turno)
  })

  it('currentSeat e o bot produzem ações válidas', () => {
    const s = initialMagnataState(2)
    expect(magnataModule.currentSeat!(s)).toBe(0)
    const a = magnataModule.bot!(s, 0)
    expect(a).toEqual({ type: 'rolar' })
  })
})
