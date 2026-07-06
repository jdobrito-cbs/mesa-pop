import { describe, expect, it } from 'vitest'
import { BANCO_CRUZADINHA, CRUZ_QTD, gerarCruzadinha } from '@mesapop/shared'

describe('Cruzadinha — banco', () => {
  it('verbetes A–Z sem acento, com dica e sem duplicatas', () => {
    expect(BANCO_CRUZADINHA.length).toBeGreaterThanOrEqual(70)
    const palavras = new Set<string>()
    for (const v of BANCO_CRUZADINHA) {
      expect(v.p).toMatch(/^[A-Z]{3,12}$/)
      expect(v.d.length).toBeGreaterThan(8)
      expect(palavras.has(v.p)).toBe(false)
      palavras.add(v.p)
    }
  })
})

describe('Cruzadinha — gerador', () => {
  it('a mesma seed gera a MESMA grade', () => {
    const a = gerarCruzadinha('2026-07-05')
    const b = gerarCruzadinha('2026-07-05')
    expect(a.solucao).toEqual(b.solucao)
    expect(a.palavras.map((p) => p.palavra)).toEqual(b.palavras.map((p) => p.palavra))
    expect(gerarCruzadinha('outra').solucao).not.toEqual(a.solucao)
  })

  it.each(['a', 'b', 'c', 'd', 'e'])('seed %s: grade densa, conectada e fiel ao gabarito', (seed) => {
    const p = gerarCruzadinha(seed)
    expect(p.palavras.length).toBeGreaterThanOrEqual(9)
    expect(p.palavras.length).toBeLessThanOrEqual(CRUZ_QTD)

    const ocupadas = new Set<string>()
    for (const palavra of p.palavras) {
      // as células soletram exatamente a palavra
      const soletrada = palavra.cells.map(([r, c]) => p.solucao[r]![c]).join('')
      expect(soletrada).toBe(palavra.palavra)
      // linha reta na direção declarada
      for (let k = 1; k < palavra.cells.length; k++) {
        const [r0, c0] = palavra.cells[k - 1]!
        const [r1, c1] = palavra.cells[k]!
        expect(r1 - r0).toBe(palavra.dir === 'V' ? 1 : 0)
        expect(c1 - c0).toBe(palavra.dir === 'H' ? 1 : 0)
      }
      for (const [r, c] of palavra.cells) ocupadas.add(`${r}-${c}`)
    }

    // toda palavra (menos a primeira) cruza pelo menos uma outra
    for (let i = 1; i < p.palavras.length; i++) {
      const minhas = new Set(p.palavras[i]!.cells.map(([r, c]) => `${r}-${c}`))
      const cruza = p.palavras.some(
        (outra, j) => j !== i && outra.cells.some(([r, c]) => minhas.has(`${r}-${c}`)),
      )
      expect(cruza).toBe(true)
    }

    // nenhuma célula preenchida fora das palavras
    let preenchidas = 0
    for (let r = 0; r < p.tam; r++) {
      for (let c = 0; c < p.tam; c++) {
        if (p.solucao[r]![c]) {
          preenchidas++
          expect(ocupadas.has(`${r}-${c}`)).toBe(true)
        }
      }
    }
    expect(preenchidas).toBe(ocupadas.size)
  })

  it('números seguem a leitura (linha→coluna) e dicas acompanham', () => {
    const p = gerarCruzadinha('numeros')
    const ordenadas = [...p.palavras].sort((a, b) => a.linha - b.linha || a.coluna - b.coluna)
    let anterior = 0
    for (const palavra of ordenadas) {
      expect(palavra.numero).toBeGreaterThanOrEqual(anterior)
      anterior = palavra.numero
      expect(palavra.dica.length).toBeGreaterThan(5)
    }
  })
})
