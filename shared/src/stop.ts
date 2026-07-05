/**
 * Stop! (Adedanha) — sorteia uma LETRA; todos preenchem as categorias;
 * quem completar pode gritar STOP. MÃO ESCONDIDA: as respostas dos
 * outros só aparecem no resultado da rodada.
 * Pontos: resposta única válida = 10 · repetida = 5 · inválida/vazia = 0.
 */

export const STOP_CATEGORIAS = ['Nome', 'Animal', 'Fruta', 'Cor', 'Objeto', 'Lugar', 'Profissão'] as const

export type StopFase = 'preenchendo' | 'resultado' | 'fim'

export interface StopResultadoLinha {
  seat: number
  respostas: string[]
  pontos: number[]
  total: number
}

export interface StopView {
  fase: StopFase
  rodada: number
  totalRodadas: number
  letra: string
  tempo: number
  /** minhas respostas em edição (as dos outros ficam ocultas) */
  minhas: string[]
  /** quantas categorias cada rival já preencheu (sem os textos!) */
  progresso: Array<{ seat: number; preenchidas: number }>
  /** quem apertou o STOP nesta rodada (-1 = tempo esgotou) */
  stopPor: number | null
  /** tabela completa — apenas na fase de resultado/fim */
  resultado: StopResultadoLinha[] | null
  scores: number[]
  vencedores: number[]
}

export const STOP_TEMPO_RODADA = 90
export const STOP_TEMPO_RESULTADO = 12
export const STOP_RODADAS = 4

export function normalizaResposta(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
