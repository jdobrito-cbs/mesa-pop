import { describe, expect, it } from 'vitest'
import {
  aplicaMemoriaAction,
  initialMemoriaState,
  memoriaViewFor,
  type MemoriaState,
} from '../src/games/memoria'

/** tabuleiro determinístico: pares lado a lado (0,0,1,1,2,2,…) */
function estado2p(): MemoriaState {
  const s = initialMemoriaState(2)
  s.valores = s.valores.map((_, i) => Math.floor(i / 2))
  return s
}

describe('Jogo da Memória', () => {
  it('nasce com 36 cartas (18 pares) e tudo oculto', () => {
    const s = initialMemoriaState(2)
    expect(s.valores).toHaveLength(36)
    const porValor = new Map<number, number>()
    for (const v of s.valores) porValor.set(v, (porValor.get(v) ?? 0) + 1)
    expect([...porValor.values()].every((n) => n === 2)).toBe(true)
    expect(memoriaViewFor(s).cartas.every((c) => c.estado === 'oculta')).toBe(true)
  })

  it('SEGREDO NO SERVIDOR: a visão não contém o valor das cartas ocultas', () => {
    const s = estado2p()
    aplicaMemoriaAction(s, 0, { type: 'virar', index: 0 })
    const view = memoriaViewFor(s)
    expect(view.cartas[0]).toEqual({ estado: 'virada', valor: 0 })
    // nenhuma OUTRA carta expõe valor
    expect(view.cartas.slice(1).every((c) => c.valor === undefined)).toBe(true)
    expect(JSON.stringify(view.cartas.slice(1))).not.toContain('valor')
  })

  it('par certo captura, soma e mantém a vez', () => {
    const s = estado2p()
    aplicaMemoriaAction(s, 0, { type: 'virar', index: 0 })
    aplicaMemoriaAction(s, 0, { type: 'virar', index: 1 })
    expect(s.pares).toEqual([1, 0])
    expect(s.turno).toBe(0) // joga de novo
    expect(memoriaViewFor(s).cartas[0]).toMatchObject({ estado: 'presa', dono: 0 })
    // par preso não vira de novo
    const denovo = aplicaMemoriaAction(s, 0, { type: 'virar', index: 0 })
    expect('error' in denovo).toBe(true)
  })

  it('par errado revela na ultimaJogada, esconde e passa a vez', () => {
    const s = estado2p()
    aplicaMemoriaAction(s, 0, { type: 'virar', index: 0 })
    aplicaMemoriaAction(s, 0, { type: 'virar', index: 2 })
    expect(s.turno).toBe(1)
    const view = memoriaViewFor(s)
    expect(view.ultimaJogada).toMatchObject({ a: 0, b: 2, va: 0, vb: 1, acertou: false })
    expect(view.cartas[0]!.estado).toBe('oculta')
    expect(view.cartas[2]!.estado).toBe('oculta')
    const foraDaVez = aplicaMemoriaAction(s, 0, { type: 'virar', index: 4 })
    expect('error' in foraDaVez).toBe(true)
  })

  it('capturar tudo fecha o jogo e aponta quem fez mais pares', () => {
    const s = estado2p()
    // seat 0 captura tudo (sabe onde estão os pares 😏)
    for (let par = 0; par < 18; par++) {
      aplicaMemoriaAction(s, 0, { type: 'virar', index: par * 2 })
      aplicaMemoriaAction(s, 0, { type: 'virar', index: par * 2 + 1 })
    }
    expect(s.fim).toBe(true)
    expect(s.vencedores).toEqual([0])
    expect(s.pares).toEqual([18, 0])
    const depois = aplicaMemoriaAction(s, 0, { type: 'virar', index: 0 })
    expect('error' in depois).toBe(true)
  })
})
