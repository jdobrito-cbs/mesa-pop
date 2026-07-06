/**
 * PRNG semeado (mulberry32) — geração DETERMINÍSTICA de puzzles: a mesma
 * seed produz sempre o mesmo Sudoku/caça-palavras. É o alicerce do modo
 * "desafio diário" (seed = data) e deixa os geradores testáveis.
 */

/** string → uint32 (FNV-1a) para usar como seed */
export function hashSeed(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** retorna um gerador [0, 1) determinístico a partir da seed */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** inteiro em [0, n) */
export function intAte(rnd: () => number, n: number): number {
  return Math.floor(rnd() * n)
}

/** embaralha uma cópia do array com o rnd semeado */
export function embaralha<T>(rnd: () => number, itens: T[]): T[] {
  const arr = [...itens]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = intAte(rnd, i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}
