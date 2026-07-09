import { describe, expect, it } from 'vitest'
import {
  custoResgate,
  grupoDe,
  MAGNATA_CARTAO_INICIAL,
  MAGNATA_CASAS,
  MAGNATA_DINHEIRO_INICIAL,
  valorHipoteca,
} from '@mesapop/shared'
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

  it('HIPOTECA: rende metade do preço; resgatar cobra o valor + juros', () => {
    const s = initialMagnataState(2)
    s.donoDe[1] = 0
    s.jogadores[0]!.props.push(1)
    const preco = MAGNATA_CASAS[1]!.preco!
    const caixa = s.jogadores[0]!.dinheiro
    const r = magnataModule.play(s, 0, { type: 'hipotecar', casa: 1 })
    expect('state' in r).toBe(true)
    expect(s.jogadores[0]!.hipotecadas).toContain(1)
    expect(s.jogadores[0]!.dinheiro).toBe(caixa + valorHipoteca(preco))
    const caixa2 = s.jogadores[0]!.dinheiro
    magnataModule.play(s, 0, { type: 'resgatar', casa: 1 })
    expect(s.jogadores[0]!.hipotecadas).not.toContain(1)
    expect(s.jogadores[0]!.dinheiro).toBe(caixa2 - custoResgate(preco))
  })

  it('HIPOTECA: bloqueia construir no grupo hipotecado', () => {
    const s = initialMagnataState(2)
    const grupo = grupoDe('marrom')
    for (const i of grupo) {
      s.donoDe[i] = 0
      s.jogadores[0]!.props.push(i)
    }
    s.fase = 'agir'
    s.jogadores[0]!.dinheiro = 2000
    magnataModule.play(s, 0, { type: 'hipotecar', casa: grupo[0]! })
    const r = magnataModule.play(s, 0, { type: 'construir', casa: grupo[1]! })
    expect('error' in r).toBe(true)
  })

  it('HIPOTECA: exige vender as casas antes; venderCasa reembolsa metade', () => {
    const s = initialMagnataState(2)
    const grupo = grupoDe('marrom')
    for (const i of grupo) {
      s.donoDe[i] = 0
      s.jogadores[0]!.props.push(i)
    }
    s.fase = 'agir'
    s.jogadores[0]!.dinheiro = 2000
    magnataModule.play(s, 0, { type: 'construir', casa: grupo[0]! })
    expect(s.jogadores[0]!.casas[grupo[0]!]).toBe(1)
    const bloq = magnataModule.play(s, 0, { type: 'hipotecar', casa: grupo[0]! })
    expect('error' in bloq).toBe(true)
    magnataModule.play(s, 0, { type: 'venderCasa', casa: grupo[0]! })
    expect(s.jogadores[0]!.casas[grupo[0]!]).toBe(0)
    const ok = magnataModule.play(s, 0, { type: 'hipotecar', casa: grupo[0]! })
    expect('state' in ok).toBe(true)
  })

  it('LEILÃO: recusar a compra leva a leilão e o arremate cobra o lance', () => {
    const s = initialMagnataState(3)
    s.fase = 'comprar'
    s.compravel = 1
    magnataModule.play(s, 0, { type: 'passar' })
    expect(s.fase).toBe('leilao')
    expect(s.leilao!.vez).toBe(1)
    expect(magnataModule.currentSeat!(s)).toBe(1)
    magnataModule.play(s, 1, { type: 'lance', valor: 30 })
    expect(s.leilao!.lider).toBe(1)
    magnataModule.play(s, 2, { type: 'desistir' })
    const antes = s.jogadores[1]!.dinheiro
    magnataModule.play(s, 0, { type: 'desistir' })
    expect(s.leilao).toBeNull()
    expect(s.donoDe[1]).toBe(1)
    expect(s.jogadores[1]!.props).toContain(1)
    expect(s.jogadores[1]!.dinheiro).toBe(antes - 30)
    expect(s.fase).toBe('agir')
  })

  it('LEILÃO: se ninguém dá lance, a propriedade fica com o banco', () => {
    const s = initialMagnataState(2)
    s.fase = 'comprar'
    s.compravel = 1
    magnataModule.play(s, 0, { type: 'passar' })
    magnataModule.play(s, 1, { type: 'desistir' })
    magnataModule.play(s, 0, { type: 'desistir' })
    expect(s.leilao).toBeNull()
    expect(s.donoDe[1]).toBeNull()
    expect(s.fase).toBe('agir')
  })

  it('NEGOCIAÇÃO: propor trava o turno, o alvo decide e aceitar transfere props + dinheiro', () => {
    const s = initialMagnataState(2)
    s.donoDe[1] = 0
    s.jogadores[0]!.props.push(1)
    s.donoDe[3] = 1
    s.jogadores[1]!.props.push(3)
    s.fase = 'agir'
    const caixa0 = s.jogadores[0]!.dinheiro
    const caixa1 = s.jogadores[1]!.dinheiro
    const r = magnataModule.play(s, 0, {
      type: 'propor',
      para: 1,
      ofereceProps: [1],
      ofereceDinheiro: 50,
      pedeProps: [3],
      pedeDinheiro: 0,
    })
    expect('state' in r).toBe(true)
    expect(s.proposta).not.toBeNull()
    expect(magnataModule.currentSeat!(s)).toBe(1) // agora quem decide é o alvo
    const bloq = magnataModule.play(s, 0, { type: 'rolar' }) // proponente travado
    expect('error' in bloq).toBe(true)
    magnataModule.play(s, 1, { type: 'aceitarTroca' })
    expect(s.proposta).toBeNull()
    expect(s.donoDe[1]).toBe(1)
    expect(s.donoDe[3]).toBe(0)
    expect(s.jogadores[0]!.dinheiro).toBe(caixa0 - 50)
    expect(s.jogadores[1]!.dinheiro).toBe(caixa1 + 50)
    expect(magnataModule.currentSeat!(s)).toBe(0) // turno volta ao proponente
  })

  it('NEGOCIAÇÃO: recusar limpa a proposta sem mover nada', () => {
    const s = initialMagnataState(2)
    s.donoDe[1] = 0
    s.jogadores[0]!.props.push(1)
    s.fase = 'agir'
    magnataModule.play(s, 0, {
      type: 'propor',
      para: 1,
      ofereceProps: [1],
      ofereceDinheiro: 0,
      pedeProps: [],
      pedeDinheiro: 20,
    })
    expect(s.proposta).not.toBeNull()
    magnataModule.play(s, 1, { type: 'recusarTroca' })
    expect(s.proposta).toBeNull()
    expect(s.donoDe[1]).toBe(0)
  })
})
