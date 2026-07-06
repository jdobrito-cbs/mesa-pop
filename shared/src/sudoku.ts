/**
 * Sudoku — gerador determinístico por seed com SOLUÇÃO ÚNICA garantida.
 * 1) preenche uma grade completa por backtracking (dígitos embaralhados
 *    pela seed); 2) remove células em ordem aleatória, mantendo cada
 *    remoção só se o puzzle continuar com UMA solução (contador com
 *    corte em 2). A dificuldade define quantas pistas ficam.
 */
import { embaralha, hashSeed, mulberry32 } from './seed.js'

export type SudokuDificuldade = 'facil' | 'medio' | 'dificil'

export interface SudokuPuzzle {
  /** 81 células, 0 = vazia */
  puzzle: number[]
  solucao: number[]
  pistas: number
  dificuldade: SudokuDificuldade
  seed: string
}

/** alvo de pistas restantes por dificuldade (para ~conferir com a base) */
export const SUDOKU_ALVOS: Record<SudokuDificuldade, number> = {
  facil: 40,
  medio: 32,
  dificil: 26,
}

export const SUDOKU_BASE_PONTOS: Record<SudokuDificuldade, number> = {
  facil: 600,
  medio: 1000,
  dificil: 1500,
}

const LINHA = (i: number) => Math.floor(i / 9)
const COL = (i: number) => i % 9
const BLOCO = (i: number) => Math.floor(LINHA(i) / 3) * 3 + Math.floor(COL(i) / 3)

export function podeColocar(grade: number[], i: number, d: number): boolean {
  const r = LINHA(i)
  const c = COL(i)
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let k = 0; k < 9; k++) {
    if (grade[r * 9 + k] === d) return false
    if (grade[k * 9 + c] === d) return false
    if (grade[(br + Math.floor(k / 3)) * 9 + bc + (k % 3)] === d) return false
  }
  return true
}

function preencheCompleto(rnd: () => number): number[] {
  const grade = Array.from({ length: 81 }, () => 0)
  const digitosPorCelula: number[][] = []
  function tenta(i: number): boolean {
    if (i === 81) return true
    if (!digitosPorCelula[i]) digitosPorCelula[i] = embaralha(rnd, [1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const d of digitosPorCelula[i]!) {
      if (podeColocar(grade, i, d)) {
        grade[i] = d
        if (tenta(i + 1)) return true
        grade[i] = 0
      }
    }
    digitosPorCelula[i] = undefined as unknown as number[]
    return false
  }
  tenta(0)
  return grade
}

/** conta soluções com corte (para no `limite`) */
export function contaSolucoes(puzzle: number[], limite = 2): number {
  const grade = [...puzzle]
  let achadas = 0
  function resolve(): void {
    if (achadas >= limite) return
    // célula vazia com MENOS candidatos (acelera muito)
    let melhor = -1
    let candidatos: number[] | null = null
    for (let i = 0; i < 81; i++) {
      if (grade[i] !== 0) continue
      const cs: number[] = []
      for (let d = 1; d <= 9; d++) if (podeColocar(grade, i, d)) cs.push(d)
      if (cs.length === 0) return // beco sem saída
      if (!candidatos || cs.length < candidatos.length) {
        melhor = i
        candidatos = cs
        if (cs.length === 1) break
      }
    }
    if (melhor === -1) {
      achadas++
      return
    }
    for (const d of candidatos!) {
      grade[melhor] = d
      resolve()
      grade[melhor] = 0
      if (achadas >= limite) return
    }
  }
  resolve()
  return achadas
}

export function gerarSudoku(seed: string, dificuldade: SudokuDificuldade): SudokuPuzzle {
  const rnd = mulberry32(hashSeed(`sudoku:${seed}:${dificuldade}`))
  const solucao = preencheCompleto(rnd)
  const puzzle = [...solucao]
  const alvo = SUDOKU_ALVOS[dificuldade]
  let pistas = 81
  for (const i of embaralha(rnd, Array.from({ length: 81 }, (_, k) => k))) {
    if (pistas <= alvo) break
    const guardada = puzzle[i]!
    puzzle[i] = 0
    if (contaSolucoes(puzzle, 2) === 1) {
      pistas--
    } else {
      puzzle[i] = guardada // essa remoção abriria uma 2ª solução
    }
  }
  return { puzzle, solucao, pistas, dificuldade, seed }
}

/** grade completa e válida? (usada em teste e no futuro desafio diário) */
export function sudokuValido(grade: number[]): boolean {
  if (grade.length !== 81 || grade.some((d) => d < 1 || d > 9)) return false
  for (let i = 0; i < 81; i++) {
    const d = grade[i]!
    for (let j = i + 1; j < 81; j++) {
      if (grade[j] !== d) continue
      if (LINHA(i) === LINHA(j) || COL(i) === COL(j) || BLOCO(i) === BLOCO(j)) return false
    }
  }
  return true
}
