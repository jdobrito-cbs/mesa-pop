/**
 * Quiz (trivia realtime) — tipos compartilhados. UMA engine, DOIS jogos
 * (Quiz Pop e Quiz Nostalgia): muda só o banco de perguntas, que vive
 * NO SERVIDOR. A alternativa correta nunca trafega antes da revelação.
 */

export const QUIZ_RODADAS = 10
export const QUIZ_TEMPO_PERGUNTA = 15 // segundos
export const QUIZ_TEMPO_REVELACAO = 4
export const QUIZ_PONTOS_BASE = 100
export const QUIZ_BONUS_RAPIDEZ = 50 // proporcional ao tempo restante

export type QuizFase = 'pergunta' | 'revelacao' | 'fim'

export type QuizAction = { type: 'resposta'; index: number }

export interface QuizView {
  fase: QuizFase
  players: number
  rodada: number
  totalRodadas: number
  categoria: string
  pergunta: string
  alternativas: string[]
  tempoRestante: number
  /** sua resposta travada (null = ainda não respondeu) */
  minhaResposta: number | null
  /** quem já respondeu (sem revelar o quê) */
  responderam: boolean[]
  /** índice da correta — SÓ na revelação/fim (null durante a pergunta) */
  correta: number | null
  /** respostas de todos — SÓ na revelação */
  respostas: Array<number | null> | null
  /** pontos ganhos na última revelação, por assento */
  ganhoUltima: number[]
  placar: number[]
  vencedores: number[]
}
