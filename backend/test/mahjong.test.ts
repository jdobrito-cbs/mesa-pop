import { describe, expect, it } from 'vitest'
import {
  gerarMahjong,
  montaLayout,
  movimentosPossiveis,
  slotsLivres,
  tilesMatch,
  type MahjongDificuldade,
} from '@mesapop/shared'

const NIVEIS: MahjongDificuldade[] = ['facil', 'medio', 'dificil']

/** joga a solução gravada e confirma que zera o tabuleiro com lances válidos */
function resolveSeguindoSolucao(seed: string, dif: MahjongDificuldade): boolean {
  const deal = gerarMahjong(seed, dif)
  const removidas = new Set<number>()
  for (const [a, b] of deal.solucao) {
    const livres = new Set(slotsLivres(deal.slots, removidas))
    if (!livres.has(a) || !livres.has(b)) return false
    if (!tilesMatch(deal.tiles[a]!, deal.tiles[b]!)) return false
    removidas.add(a)
    removidas.add(b)
  }
  return removidas.size === deal.slots.length
}

describe('Mahjong — layout', () => {
  it('cada nível tem contagem PAR de peças e no máximo 144', () => {
    for (const dif of NIVEIS) {
      const slots = montaLayout(dif)
      expect(slots.length % 2).toBe(0)
      expect(slots.length).toBeLessThanOrEqual(144)
      expect(slots.length).toBeGreaterThan(20)
    }
  })

  it('a dificuldade cresce em número de peças e camadas', () => {
    const facil = montaLayout('facil')
    const medio = montaLayout('medio')
    const dificil = montaLayout('dificil')
    expect(medio.length).toBeGreaterThan(facil.length)
    const camadas = (s: ReturnType<typeof montaLayout>) => new Set(s.map((t) => t.layer)).size
    expect(camadas(dificil)).toBeGreaterThan(camadas(facil))
  })
})

describe('Mahjong — geração resolvível', () => {
  it('todo deal é resolvível seguindo a solução gravada (10 seeds × 3 níveis)', () => {
    for (const dif of NIVEIS) {
      for (let s = 0; s < 10; s++) {
        expect(resolveSeguindoSolucao(`seed-${dif}-${s}`, dif)).toBe(true)
      }
    }
  })

  it('usa no máximo 4 cópias de cada peça (contagem válida)', () => {
    const deal = gerarMahjong('cont', 'medio')
    const cont = new Map<string, number>()
    for (const t of deal.tiles) {
      const k = `${t.suit}${t.rank}`
      cont.set(k, (cont.get(k) ?? 0) + 1)
    }
    for (const n of cont.values()) expect(n).toBeLessThanOrEqual(4)
  })

  it('mesma seed → mesmo tabuleiro (determinístico)', () => {
    const a = gerarMahjong('igual', 'dificil')
    const b = gerarMahjong('igual', 'dificil')
    expect(JSON.stringify(a.tiles)).toBe(JSON.stringify(b.tiles))
  })

  it('sempre há pelo menos um par livre no começo', () => {
    for (const dif of NIVEIS) {
      const deal = gerarMahjong(`abre-${dif}`, dif)
      expect(movimentosPossiveis(deal, new Set()).length).toBeGreaterThan(0)
    }
  })
})

describe('Mahjong — regras de peça', () => {
  it('peça coberta não é livre; casamento respeita naipe/valor e flores/estações', () => {
    // flores casam entre si; caracteres só com mesmo valor
    expect(tilesMatch({ suit: 'flower', rank: 1 }, { suit: 'flower', rank: 3 })).toBe(true)
    expect(tilesMatch({ suit: 'season', rank: 2 }, { suit: 'season', rank: 4 })).toBe(true)
    expect(tilesMatch({ suit: 'char', rank: 5 }, { suit: 'char', rank: 5 })).toBe(true)
    expect(tilesMatch({ suit: 'char', rank: 5 }, { suit: 'char', rank: 6 })).toBe(false)
    expect(tilesMatch({ suit: 'dot', rank: 3 }, { suit: 'bam', rank: 3 })).toBe(false)

    // uma peça diretamente coberta por uma de cima não é livre
    const slots = [
      { id: 0, layer: 0, x: 0, y: 0 },
      { id: 1, layer: 1, x: 0, y: 0 },
    ]
    const livres = slotsLivres(slots, new Set())
    expect(livres).toContain(1)
    expect(livres).not.toContain(0)
  })
})
