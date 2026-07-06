/**
 * Bingo 75 — tipos compartilhados. Cartela 5×5 (colunas B-I-N-G-O,
 * centro LIVRE), bolas cantadas pelo SERVIDOR em ritmo constante,
 * marcação manual validada e BINGO! conferido no servidor: vence a
 * primeira LINHA completa (horizontal, vertical ou diagonal).
 */

export const BINGO_COLUNAS = ['B', 'I', 'N', 'G', 'O'] as const
export const BINGO_INTERVALO = 3.5 // segundos entre bolas

export type BingoFase = 'sorteando' | 'fim'

export type BingoAction = { type: 'marcar'; index: number } | { type: 'bingo' }

export interface BingoView {
  fase: BingoFase
  players: number
  /** última bola cantada (null antes da primeira) */
  bolaAtual: number | null
  /** todas as bolas já sorteadas, na ordem */
  bolas: number[]
  /** segundos até a próxima bola */
  proximaEm: number
  /** 25 números da SUA cartela (0 = casa livre do centro) */
  minhaCartela: number[]
  minhasMarcadas: boolean[]
  /** progresso dos rivais (quantidade de marcas) */
  rivais: Array<{ seat: number; marcadas: number }>
  vencedor: number | null
  /** as 5 casas da linha vencedora (índices 0..24), revelada no fim */
  linhaVencedora: number[] | null
}

/** letra da coluna de uma bola (B-1..15, I-16..30, N, G, O-61..75) */
export function bingoLetra(bola: number): string {
  return BINGO_COLUNAS[Math.min(4, Math.floor((bola - 1) / 15))]!
}

/** todas as linhas vitoriosas da cartela 5×5 (linhas, colunas, diagonais) */
export const BINGO_LINHAS: number[][] = [
  ...Array.from({ length: 5 }, (_, r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...Array.from({ length: 5 }, (_, c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]
