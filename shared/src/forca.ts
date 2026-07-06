/**
 * Forca multiplayer — tipos compartilhados. A PALAVRA SECRETA vive só no
 * servidor: quem adivinha recebe apenas as letras já reveladas (null nas
 * ocultas). Rodadas rotativas: cada jogador escolhe a palavra uma vez.
 */

export const FORCA_MAX_ERROS = 6 // cabeça, tronco, 2 braços, 2 pernas

export type ForcaFase = 'escolhendo' | 'jogando' | 'fim'

export type ForcaAction =
  | { type: 'palavra'; palavra: string }
  | { type: 'letra'; letra: string }
  | { type: 'chute'; palavra: string }

export interface ForcaView {
  fase: ForcaFase
  players: number
  rodada: number
  totalRodadas: number
  escolhedor: number
  /** null = letra ainda oculta (escolhedor e fim de rodada veem tudo) */
  palavraVista: Array<string | null>
  letrasErradas: string[]
  letrasCertas: string[]
  erros: number
  maxErros: number
  turno: number
  pontos: number[]
  /** narração da última jogada ("B apareceu 2×!", "Não tem X…") */
  ultimoEvento: string | null
  vencedores: number[]
}

/** normaliza para A–Z maiúsculas sem acento (ç → c) */
export function normalizaForca(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '')
}
