import { describe, expect, it } from 'vitest'
import {
  CACA_QTD_PALAVRAS,
  CACA_TAM,
  contaSolucoes,
  gerarCacaPalavras,
  gerarSudoku,
  SUDOKU_ALVOS,
  sudokuValido,
} from '@mesapop/shared'

describe('Sudoku — gerador por seed', () => {
  it('a mesma seed gera o MESMO puzzle (determinístico)', () => {
    const a = gerarSudoku('2026-07-05', 'medio')
    const b = gerarSudoku('2026-07-05', 'medio')
    expect(a.puzzle).toEqual(b.puzzle)
    expect(a.solucao).toEqual(b.solucao)
    const c = gerarSudoku('outra-seed', 'medio')
    expect(c.puzzle).not.toEqual(a.puzzle)
  })

  it('a solução é uma grade válida e bate com as pistas', () => {
    const p = gerarSudoku('teste', 'facil')
    expect(sudokuValido(p.solucao)).toBe(true)
    for (let i = 0; i < 81; i++) {
      if (p.puzzle[i] !== 0) expect(p.puzzle[i]).toBe(p.solucao[i])
    }
  })

  it.each(['facil', 'medio', 'dificil'] as const)('%s: solução ÚNICA e pistas no alvo', (dif) => {
    const p = gerarSudoku('unico', dif)
    expect(contaSolucoes(p.puzzle, 2)).toBe(1)
    expect(p.pistas).toBeGreaterThanOrEqual(SUDOKU_ALVOS[dif])
    expect(p.pistas).toBeLessThan(50)
    expect(p.puzzle.filter((d) => d !== 0)).toHaveLength(p.pistas)
  })
})

describe('Caça-palavras — gerador por seed', () => {
  it('a mesma seed gera a MESMA sopa; grade 12×12 completa', () => {
    const a = gerarCacaPalavras('2026-07-05')
    const b = gerarCacaPalavras('2026-07-05')
    expect(a.grid).toEqual(b.grid)
    expect(a.tema).toBe(b.tema)
    expect(a.grid).toHaveLength(CACA_TAM)
    expect(a.grid.every((linha) => linha.length === CACA_TAM && linha.every((l) => /^[A-Z]$/.test(l)))).toBe(true)
  })

  it('todas as palavras estão de fato na grade, letra a letra', () => {
    const p = gerarCacaPalavras('confere')
    expect(p.palavras).toHaveLength(CACA_QTD_PALAVRAS)
    for (const { palavra, cells } of p.palavras) {
      expect(cells).toHaveLength(palavra.length)
      const naGrade = cells.map(([r, c]) => p.grid[r]![c]).join('')
      expect(naGrade).toBe(palavra)
      // células em linha reta (dr/dc constantes)
      if (cells.length > 1) {
        const dr = cells[1]![0] - cells[0]![0]
        const dc = cells[1]![1] - cells[0]![1]
        for (let k = 1; k < cells.length; k++) {
          expect(cells[k]![0] - cells[k - 1]![0]).toBe(dr)
          expect(cells[k]![1] - cells[k - 1]![1]).toBe(dc)
        }
      }
    }
  })

  it('seeds diferentes variam o tema (e o tema pedido é respeitado)', () => {
    const temas = new Set(
      Array.from({ length: 12 }, (_, i) => gerarCacaPalavras(`t${i}`).tema),
    )
    expect(temas.size).toBeGreaterThan(1)
    expect(gerarCacaPalavras('x', 'Frutas').tema).toBe('Frutas')
  })
})
