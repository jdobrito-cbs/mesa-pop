/**
 * Duelo de Palavras — todos tentam a MESMA palavra secreta de 5 letras,
 * cada um na sua grade. MÃO ESCONDIDA: os rivais veem apenas as CORES
 * dos seus palpites (nunca as letras). Vence quem acertar primeiro.
 */

export interface DueloTentativa {
  palpite: string
  /** 'g' verde · 'y' amarelo · 'b' cinza (5 chars) */
  feedback: string
}

export interface DueloRivalView {
  seat: number
  /** só as cores — as letras dos rivais nunca trafegam */
  feedbacks: string[]
  acabou: boolean
  acertou: boolean
}

export interface DueloView {
  fase: 'jogando' | 'fim'
  /** segundos restantes */
  tempo: number
  minha: DueloTentativa[]
  acabei: boolean
  acertei: boolean
  rivais: DueloRivalView[]
  vencedores: number[]
  /** revelada apenas no fim */
  palavra: string | null
  maxTentativas: number
}

export const DUELO_TEMPO = 240
export const DUELO_TENTATIVAS = 6
