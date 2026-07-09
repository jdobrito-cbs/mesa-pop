/**
 * Gira Gênio — trivia com roleta de categorias (inspirado no gênero
 * "Perguntados", nome e conteúdo próprios). No seu turno: gira a roleta →
 * cai numa categoria → responde. Acertou numa categoria que ainda não tem →
 * ganha a coroa dela e joga de novo; errou → passa a vez. Junta as 6 coroas
 * e vence. As perguntas e a resposta certa vivem NO SERVIDOR (nunca vazam).
 */

export type GGCategoria = 'geo' | 'hist' | 'cien' | 'esp' | 'arte' | 'ent'

export interface GGCatInfo {
  id: GGCategoria
  nome: string
  icone: string
  cor: string
}

export const GG_CATEGORIAS: GGCatInfo[] = [
  { id: 'geo', nome: 'Geografia', icone: '🌎', cor: '#22d3ee' },
  { id: 'hist', nome: 'História', icone: '📜', cor: '#f59e0b' },
  { id: 'cien', nome: 'Ciência', icone: '🔬', cor: '#34d399' },
  { id: 'esp', nome: 'Esportes', icone: '⚽', cor: '#facc15' },
  { id: 'arte', nome: 'Arte & Cultura', icone: '🎭', cor: '#ff3ea5' },
  { id: 'ent', nome: 'Entretenimento', icone: '🎬', cor: '#a855f7' },
]

/** número de coroas (categorias) para vencer */
export const GG_META = 6

export type GGFase = 'escolhendo' | 'pergunta' | 'fim'

/** resultado do último lance, para a UI revelar (não expõe a pergunta atual) */
export interface GGUltimo {
  seat: number
  categoria: GGCategoria
  acertou: boolean
  ganhouCoroa: boolean
  /** texto da alternativa correta (para o "a resposta era…") */
  respostaCerta: string
}

/** visão que trafega para o cliente — SEM a resposta correta da pergunta ativa */
export interface GGView {
  fase: GGFase
  turn: number
  players: number
  /** coroas (categorias) de cada assento */
  coroas: GGCategoria[][]
  /** categoria sorteada na roleta (durante a pergunta) */
  categoria: GGCategoria | null
  /** pergunta ativa, com as alternativas embaralhadas (sem marcar a certa) */
  pergunta: { texto: string; opcoes: string[] } | null
  ultimo: GGUltimo | null
  winnerSeats: number[]
}

export type GGAction = { type: 'girar' } | { type: 'responder'; opcao: number }

export const catInfo = (id: GGCategoria): GGCatInfo =>
  GG_CATEGORIAS.find((c) => c.id === id)!
