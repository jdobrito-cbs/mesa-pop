/**
 * Cobra Arena (clone do slither.io) — MULTIPLAYER em tempo real, com o mundo
 * simulado no SERVIDOR. O cliente só reporta a direção (mira) e o boost; o
 * servidor move todas as cobras, come comida, cresce, checa colisões e mortes.
 * A arena é sempre povoada por cobras da IA (dá para jogar sozinho ou com
 * outros). Vence quem tiver a MAIOR cobra ao fim do tempo.
 */

/** raio da arena (círculo); bater na borda mata */
export const COBRA_RAIO = 1150
export const COBRA_DURACAO = 150 // segundos por partida
/** espaçamento entre os "anéis" do corpo */
export const COBRA_SEG = 8

export interface CobraSnakeView {
  id: string
  seat: number | null
  nome: string
  cor: string
  vivo: boolean
  boost: boolean
  /** corpo amostrado (cabeça primeiro), em coordenadas do mundo */
  corpo: Array<{ x: number; y: number }>
  raio: number
  tamanho: number
}

export interface CobraFoodView {
  x: number
  y: number
  r: number
  c: string
}

export interface CobraPlacar {
  seat: number | null
  nome: string
  tamanho: number
  vivo: boolean
}

export interface CobraSnapshot {
  raio: number
  tempo: number
  duracao: number
  snakes: CobraSnakeView[]
  food: CobraFoodView[]
  /** placar (maiores cobras) para o HUD */
  placar: CobraPlacar[]
  finished: boolean
  winnerSeats: number[]
  draw: boolean
}

export type CobraAction = { type: 'mira'; angulo: number } | { type: 'boost'; on: boolean }
