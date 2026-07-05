/**
 * Desenha & Adivinha — tipos e regras compartilhadas.
 * MÃO ESCONDIDA aplicada a palavras: a palavra NUNCA trafega para quem
 * adivinha (nem nos palpites certos — o chat mostra só "acertou!").
 */

export interface DesenhaStroke {
  /** cor CSS do traço ('#fff' = borracha) */
  color: string
  size: number
  /** pontos achatados [x0,y0,x1,y1,...] em coordenadas 0..1000 */
  pts: number[]
}

export interface RespostaEntry {
  seat: number
  /** null quando acertou — a palavra não é ecoada */
  text: string | null
  acertou: boolean
}

export type DesenhaFase = 'escolhendo' | 'desenhando' | 'revelacao' | 'fim'

/** visão filtrada por assento (a palavra só para o desenhista/revelação) */
export interface DesenhaView {
  fase: DesenhaFase
  rodada: number
  totalRodadas: number
  desenhistaSeat: number
  /** segundos restantes da fase atual */
  tempo: number
  /** "s u _ _ _ _" — apenas na fase de desenho, para quem adivinha */
  dica: string | null
  /** a palavra em si — só desenhista, revelação e fim */
  palavra: string | null
  strokes: DesenhaStroke[]
  scores: number[]
  /** assentos que já acertaram nesta rodada */
  acertaram: number[]
  respostas: RespostaEntry[]
  vencedores: number[]
}

export const DESENHA_TEMPO_ESCOLHA = 45
export const DESENHA_TEMPO_RODADA = 180
export const DESENHA_TEMPO_REVELACAO = 5
export const DESENHA_RODADAS_POR_JOGADOR = 2

/** normaliza palpites/palavras: minúsculas, sem acentos, espaços únicos */
export function normalizaPalavra(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Dica com tracinhos ("_ _ _ _"), preservando espaços; `reveladas` letras
 * aparecem em posições determinísticas espalhadas.
 */
export function dicaDe(palavra: string, reveladas: number): string {
  const chars = [...palavra]
  const letras = chars.map((c, i) => ({ c, i })).filter(({ c }) => c !== ' ')
  const mostrar = new Set<number>()
  for (let k = 0; k < Math.min(reveladas, Math.floor(letras.length / 3)); k++) {
    const idx = letras[Math.floor(((k + 1) * letras.length) / (reveladas + 1))]?.i
    if (idx !== undefined) mostrar.add(idx)
  }
  return chars.map((c, i) => (c === ' ' ? ' ' : mostrar.has(i) ? c : '_')).join(' ')
}
