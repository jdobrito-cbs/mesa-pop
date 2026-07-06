/**
 * Caça-palavras — gerador determinístico por seed: 10 palavras de um
 * tema, colocadas numa grade 12×12 nas 8 direções (cruzamentos com a
 * mesma letra valem), completada com letras camufladas (amostradas das
 * próprias palavras). O gerador devolve as células de cada palavra —
 * é o gabarito dos testes e a base do futuro desafio diário.
 */
import { embaralha, hashSeed, intAte, mulberry32 } from './seed.js'

export const CACA_TAM = 12
export const CACA_QTD_PALAVRAS = 10

/** palavras pt-BR sem acento, maiúsculas, até 12 letras */
export const CACA_TEMAS: Record<string, string[]> = {
  Frutas: [
    'BANANA', 'ABACAXI', 'LARANJA', 'MORANGO', 'GOIABA', 'MELANCIA', 'CAJU', 'MANGA',
    'UVA', 'PERA', 'JABUTICABA', 'ACEROLA', 'MARACUJA', 'PITANGA', 'AMEIXA', 'COCO',
    'LIMAO', 'GRAVIOLA', 'CUPUACU', 'TANGERINA',
  ],
  Bichos: [
    'CACHORRO', 'GATO', 'TAMANDUA', 'CAPIVARA', 'ARARA', 'JACARE', 'ONCA', 'TATU',
    'MACACO', 'TUCANO', 'BOTO', 'LOBO', 'GUARA', 'SERIEMA', 'QUATI', 'ANTA',
    'PREGUICA', 'GAMBA', 'CORUJA', 'SAGUI',
  ],
  Cozinha: [
    'PANELA', 'FRIGIDEIRA', 'CONCHA', 'ESPETO', 'GARFO', 'FACA', 'COLHER', 'PENEIRA',
    'RALADOR', 'TABUA', 'CHALEIRA', 'CANECA', 'TRAVESSA', 'FUNIL', 'BATEDEIRA', 'FORMA',
    'ESCORREDOR', 'ABRIDOR', 'JARRA', 'POTE',
  ],
  Brasil: [
    'SAMBA', 'CARNAVAL', 'FUTEBOL', 'FEIJOADA', 'CERRADO', 'AMAZONIA', 'PANTANAL', 'SERTAO',
    'FORRO', 'CAIPIRA', 'REDE', 'MANDIOCA', 'CANGACO', 'LITORAL', 'CAATINGA', 'VIOLA',
    'TAPIOCA', 'GUARANA', 'CUSCUZ', 'PAMONHA',
  ],
}

const DIRECOES: Array<[number, number]> = [
  [0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1],
]

export interface CacaPalavra {
  palavra: string
  /** [linha, coluna] de cada letra, na ordem */
  cells: Array<[number, number]>
}

export interface CacaPuzzle {
  tema: string
  grid: string[][] // CACA_TAM × CACA_TAM
  palavras: CacaPalavra[]
  seed: string
}

export function gerarCacaPalavras(seed: string, temaEscolhido?: string): CacaPuzzle {
  const rnd = mulberry32(hashSeed(`caca:${seed}`))
  const temas = Object.keys(CACA_TEMAS)
  const tema = temaEscolhido && CACA_TEMAS[temaEscolhido] ? temaEscolhido : temas[intAte(rnd, temas.length)]!
  const lista = embaralha(rnd, CACA_TEMAS[tema]!).slice(0, CACA_QTD_PALAVRAS)
  // maiores primeiro encaixam melhor
  lista.sort((a, b) => b.length - a.length)

  const grid: (string | null)[][] = Array.from({ length: CACA_TAM }, () =>
    Array.from({ length: CACA_TAM }, () => null),
  )
  const palavras: CacaPalavra[] = []

  for (const palavra of lista) {
    let colocada = false
    for (let tentativa = 0; tentativa < 400 && !colocada; tentativa++) {
      const [dr, dc] = DIRECOES[intAte(rnd, DIRECOES.length)]!
      const r0 = intAte(rnd, CACA_TAM)
      const c0 = intAte(rnd, CACA_TAM)
      const rf = r0 + dr * (palavra.length - 1)
      const cf = c0 + dc * (palavra.length - 1)
      if (rf < 0 || rf >= CACA_TAM || cf < 0 || cf >= CACA_TAM) continue
      const cells: Array<[number, number]> = []
      let ok = true
      for (let k = 0; k < palavra.length; k++) {
        const r = r0 + dr * k
        const c = c0 + dc * k
        const atual = grid[r]![c]
        if (atual !== null && atual !== palavra[k]) {
          ok = false
          break
        }
        cells.push([r, c])
      }
      if (!ok) continue
      for (let k = 0; k < palavra.length; k++) grid[cells[k]![0]]![cells[k]![1]] = palavra[k]!
      palavras.push({ palavra, cells })
      colocada = true
    }
    // sem lugar após 400 tentativas: segue sem essa (raro na 12×12)
  }

  // completa com letras das próprias palavras (camuflagem)
  const sopa = lista.join('')
  for (let r = 0; r < CACA_TAM; r++) {
    for (let c = 0; c < CACA_TAM; c++) {
      if (grid[r]![c] === null) grid[r]![c] = sopa[intAte(rnd, sopa.length)]!
    }
  }

  return { tema, grid: grid as string[][], palavras, seed }
}
