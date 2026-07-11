/**
 * Tio Mário Milionário — quiz solo de ESCADA DE PRÊMIOS (formato clássico
 * de gincana de perguntas, recriado com identidade própria do Mesa Pop):
 * 16 perguntas de valor crescente até R$ 1.000.000. A cada acerto o
 * jogador sobe; pode PARAR e levar o acumulado; ERROU → leva METADE do
 * acumulado (na pergunta do milhão, sai com nada). Ajudas únicas: cartas,
 * universitários e plateia; e até 3 pulos. A resposta correta vive SÓ no
 * servidor até o jogador responder.
 */

/** escada de prêmios (16 níveis, em R$) */
export const MILHAO_ESCADA = [
  1000, 2000, 5000, 10000, 20000, 30000, 40000, 50000,
  100000, 150000, 200000, 250000, 300000, 400000, 500000, 1000000,
] as const

export const MILHAO_NIVEIS = MILHAO_ESCADA.length
export const MILHAO_PULOS = 3

export type MilhaoAjuda = 'cartas' | 'universitarios' | 'plateia' | 'pulo'
export type MilhaoResultado = 'parou' | 'errou' | 'milhao'

/** palpite de um universitário (ajuda) */
export interface MilhaoUniversitario {
  nome: string
  /** índice da alternativa apontada */
  palpite: number
  /** confiança declarada (%) */
  confianca: number
}

/** visão do cliente — NUNCA contém a resposta correta antes da hora */
export interface MilhaoView {
  fase: 'pergunta' | 'fim'
  /** nível atual (0-based; valorPergunta = MILHAO_ESCADA[nivel]) */
  nivel: number
  valorPergunta: number
  /** prêmio garantido se PARAR agora */
  acumulado: number
  /** quanto leva se ERRAR agora */
  seErrar: number
  pergunta: { categoria: string; texto: string; alternativas: string[] } | null
  /** alternativas eliminadas pelas cartas */
  eliminadas: number[]
  /** ajudas de uso único já gastas */
  ajudasUsadas: Exclude<MilhaoAjuda, 'pulo'>[]
  pulosRestantes: number
  /** resultados das ajudas (para reexibir na mesma pergunta) */
  universitarios: MilhaoUniversitario[] | null
  plateia: number[] | null
  /** reveal da ÚLTIMA resposta dada (para a animação de acerto/erro) */
  ultima: { escolha: number; correta: number; certo: boolean } | null
  /** só na fase 'fim' */
  resultado: MilhaoResultado | null
  premio: number
  /** PONTOS levados ao ranking (o prêmio em R$ é cenográfico) */
  pontosGanhos: number
  /** fichas de avatar ganhas na partida (proporcionais ao prêmio) */
  fichasGanhas: number
}

/**
 * O ranking é em PONTOS: o milhão vale 50.000 e cada prêmio parcial
 * (parou/errou no meio) leva a fração proporcional — idem as FICHAS
 * de avatar (o milhão vale 10.000; toda pergunta vencida já rende).
 */
export const MILHAO_PONTOS_MAX = 50_000
export const MILHAO_FICHAS_MAX = 10_000

/** pontos de ranking pelo prêmio em POP$ (1.000.000 → 50.000) */
export function milhaoPontos(premio: number): number {
  return Math.floor(premio / 20)
}

/** fichas de avatar pelo prêmio em POP$ (1.000.000 → 10.000; 1.000 → 10) */
export function milhaoFichas(premio: number): number {
  return Math.floor(premio / 100)
}

/** quanto o jogador leva se ERRAR tendo `acumulado` no nível `nivel` */
export function milhaoSeErrar(nivel: number, acumulado: number): number {
  if (nivel >= MILHAO_NIVEIS - 1) return 0 // a pergunta do milhão é tudo ou nada
  return Math.floor(acumulado / 2)
}

/** dificuldade da pergunta pelo nível: 0..5 fácil, 6..11 médio, 12..15 difícil */
export function milhaoTier(nivel: number): 'facil' | 'medio' | 'dificil' {
  if (nivel <= 5) return 'facil'
  if (nivel <= 11) return 'medio'
  return 'dificil'
}
