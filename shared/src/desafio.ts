/**
 * Desafio Diário — os jogos seedáveis que rodam o MESMO puzzle para todos
 * a cada dia (seed = a data 'YYYY-MM-DD'). A dificuldade é FIXA por jogo,
 * para que o ranking do dia seja justo: todo mundo joga exatamente o mesmo
 * tabuleiro. Fonte de verdade única, usada pelo cliente (hub + geração) e
 * pelo servidor (whitelist de slugs que valem desafio).
 */

export interface DesafioDef {
  slug: string
  nome: string
  icone: string
  cor: string
  /** dificuldade fixa passada ao gerador (quando o jogo tem níveis) */
  dificuldade?: 'facil' | 'medio' | 'dificil'
  descricao: string
}

export const DESAFIOS_DIARIOS: DesafioDef[] = [
  { slug: 'sudoku', nome: 'Sudoku', icone: '🔢', cor: '#22d3ee', dificuldade: 'medio', descricao: 'O clássico de 32 pistas — igual para todos hoje.' },
  { slug: 'caca-palavras', nome: 'Caça-palavras', icone: '🔤', cor: '#f59e0b', descricao: 'Uma sopa de letras nova a cada dia.' },
  { slug: 'cruzadinha', nome: 'Cruzadinha', icone: '📝', cor: '#a855f7', descricao: 'As pistas do dia, iguais para toda a mesa.' },
  { slug: 'mahjong', nome: 'Mahjong', icone: '🀄', cor: '#ec4899', dificuldade: 'medio', descricao: 'Um empilhamento inédito para desmontar.' },
]

export const DESAFIO_SLUGS: string[] = DESAFIOS_DIARIOS.map((d) => d.slug)

export function ehDesafioDiario(slug: string): boolean {
  return DESAFIO_SLUGS.includes(slug)
}

export function desafioDef(slug: string): DesafioDef | undefined {
  return DESAFIOS_DIARIOS.find((d) => d.slug === slug)
}

/** data local no formato 'YYYY-MM-DD' (fallback no cliente antes da resposta do servidor) */
export function dataDesafio(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
