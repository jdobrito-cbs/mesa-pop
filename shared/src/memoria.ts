/**
 * Jogo da Memória — tipos compartilhados. Os VALORES das cartas viradas
 * para baixo vivem só no servidor (decorar espiando o payload não rola).
 * 6×6 = 18 pares; achou o par, joga de novo; mais pares vence.
 */

export const MEMORIA_ICONES = [
  '🍉', '🚀', '🐙', '🎲', '🌵', '🎸', '🍩', '⚽', '🦜',
  '🎈', '🐳', '🍕', '⭐', '🦖', '🎯', '🐞', '🌈', '🎁',
] as const

export const MEMORIA_COLS = 6
export const MEMORIA_ROWS = 6

export interface MemoriaCarta {
  /** 'oculta' = virada p/ baixo; 'virada' = aberta na jogada; 'presa' = par achado */
  estado: 'oculta' | 'virada' | 'presa'
  /** índice em MEMORIA_ICONES — só existe quando visível */
  valor?: number
  /** assento que capturou o par (só em 'presa') */
  dono?: number
}

export interface MemoriaView {
  players: number
  cartas: MemoriaCarta[]
  turno: number
  pares: number[]
  /** última dupla virada (para animar o erro antes de esconder) */
  ultimaJogada: { a: number; b: number; va: number; vb: number; acertou: boolean } | null
  fim: boolean
  vencedores: number[]
}

export type MemoriaAction = { type: 'virar'; index: number }
