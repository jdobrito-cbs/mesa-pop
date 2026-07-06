/**
 * Cruzadinha (palavras-cruzadas estilo Coquetel) — gerador
 * determinístico por seed: escolhe ~12 palavras do banco, coloca a
 * primeira no centro e encaixa as demais SEMPRE cruzando uma letra de
 * quem já está na grade (greedy pelo maior nº de cruzamentos), com as
 * regras clássicas: célula antes/depois vazia e sem vizinhos paralelos
 * acidentais. Devolve o gabarito completo (células por palavra).
 */
import { embaralha, hashSeed, mulberry32 } from './seed.js'

export const CRUZ_TAM = 13
export const CRUZ_QTD = 12

export interface CruzVerbete {
  /** palavra A–Z sem acento */
  p: string
  /** dica curta estilo Coquetel */
  d: string
}

export const BANCO_CRUZADINHA: CruzVerbete[] = [
  { p: 'GATO', d: 'Bichano que ronrona' }, { p: 'CACHORRO', d: 'O melhor amigo do homem' },
  { p: 'ARARA', d: 'Ave colorida da Amazônia' }, { p: 'JACARE', d: 'Réptil de sorriso perigoso' },
  { p: 'TATU', d: 'Bicho que cava e vira bola' }, { p: 'CORUJA', d: 'Ave símbolo da sabedoria' },
  { p: 'ABACAXI', d: 'Fruta de coroa' }, { p: 'BANANA', d: 'Fruta da penca' },
  { p: 'LARANJA', d: 'Fruta e cor de uma vitamina' }, { p: 'MORANGO', d: 'Vermelhinho do bolo com chantili' },
  { p: 'MELANCIA', d: 'Enorme, verde por fora e vermelha por dentro' }, { p: 'CAJU', d: 'Fruta da castanha' },
  { p: 'VIOLAO', d: 'Instrumento de seis cordas da roda de samba' }, { p: 'SANFONA', d: 'A rainha do forró' },
  { p: 'PANDEIRO', d: 'Instrumento que acompanha o samba' }, { p: 'PIANO', d: 'Teclado de cauda dos concertos' },
  { p: 'SAMBA', d: 'Ritmo do carnaval carioca' }, { p: 'FORRO', d: 'Dança agarradinha do São João' },
  { p: 'FUTEBOL', d: 'O esporte das multidões' }, { p: 'GOLEIRO', d: 'O dono das luvas no time' },
  { p: 'PETECA', d: 'Vai e vem na palma da mão' }, { p: 'PIPA', d: 'Brinquedo que dança no céu' },
  { p: 'AMARELINHA', d: 'Brincadeira de pular até o céu' }, { p: 'BOLINHA', d: 'De gude, nas brincadeiras de rua' },
  { p: 'ESCOLA', d: 'Lugar de lousa e recreio' }, { p: 'CADERNO', d: 'Companheiro de espiral do lápis' },
  { p: 'LAPIS', d: 'Escreve e se apaga com borracha' }, { p: 'BORRACHA', d: 'Apaga o erro do lápis' },
  { p: 'JANELA', d: 'Abertura com cortina na parede' }, { p: 'TELHADO', d: 'Cobre a casa, telha a telha' },
  { p: 'COZINHA', d: 'Onde mora a panela' }, { p: 'PANELA', d: 'Vai ao fogo com a comida' },
  { p: 'CAFE', d: 'O pretinho do coador' }, { p: 'FEIJOADA', d: 'Prato completo da mesa de sábado' },
  { p: 'TAPIOCA', d: 'Goma da frigideira nordestina' }, { p: 'PAMONHA', d: 'Doce de milho na palha' },
  { p: 'CANJICA', d: 'Doce de milho branco das festas juninas' }, { p: 'FOGUEIRA', d: 'O calor da festa de São João' },
  { p: 'QUADRILHA', d: 'Dança em pares da festa junina' }, { p: 'BALAO', d: 'Sobe iluminando a noite junina' },
  { p: 'PRAIA', d: 'Areia, mar e guarda-sol' }, { p: 'AREIA', d: 'O chão da praia e do castelinho' },
  { p: 'ONDA', d: 'Vai e vem do mar' }, { p: 'CONCHA', d: 'Lembrancinha que o mar deixa na areia' },
  { p: 'ESTRELA', d: 'Brilha no céu à noite' }, { p: 'LUA', d: 'Cheia, nova, minguante ou crescente' },
  { p: 'CHUVA', d: 'Cai das nuvens e molha tudo' }, { p: 'ARCOIRIS', d: 'Ponte de sete cores no céu' },
  { p: 'VENTO', d: 'Sopro que leva a pipa' }, { p: 'NUVEM', d: 'Algodão do céu' },
  { p: 'RADIO', d: 'Tocava as novelas antes da TV' }, { p: 'NOVELA', d: 'Capítulo de toda noite na TV' },
  { p: 'CINEMA', d: 'Tela grande e pipoca' }, { p: 'PIPOCA', d: 'Milho que estoura na panela' },
  { p: 'CIRCO', d: 'Lona de palhaços e trapezistas' }, { p: 'PALHACO', d: 'Nariz vermelho do circo' },
  { p: 'FERIA', d: 'Barraca de frutas e pechincha na rua' }, { p: 'MERCADO', d: 'Onde se faz a compra do mês' },
  { p: 'PADARIA', d: 'O cheiro de pão quentinho da esquina' }, { p: 'AVENIDA', d: 'Rua larga do desfile' },
  { p: 'BICICLETA', d: 'Duas rodas movidas a pedal' }, { p: 'TREM', d: 'Corre nos trilhos apitando' },
  { p: 'NAVIO', d: 'Gigante que atravessa o oceano' }, { p: 'AVIAO', d: 'Corta os céus entre cidades' },
  { p: 'RELOGIO', d: 'Marca as horas no pulso ou na parede' }, { p: 'OCULOS', d: 'Ajudam os olhos a ler' },
  { p: 'CHAPEU', d: 'Protege a cabeça do sol' }, { p: 'SAPATO', d: 'Calçado de amarrar' },
  { p: 'JARDIM', d: 'Canteiro de flores da casa' }, { p: 'FLOR', d: 'Enfeita o jardim e o vaso' },
  { p: 'ARVORE', d: 'Dá sombra, fruto e ninho' }, { p: 'FOLHA', d: 'Verde que cai no outono' },
  { p: 'ABELHA', d: 'Fabricante oficial do mel' }, { p: 'MEL', d: 'Doce que a abelha faz' },
  { p: 'FORMIGA', d: 'Pequenina e trabalhadeira' }, { p: 'BORBOLETA', d: 'Sai do casulo de asas novas' },
  { p: 'DOMINGO', d: 'Dia do almoço em família' }, { p: 'ALMOCO', d: 'A refeição do meio-dia' },
  { p: 'SOBREMESA', d: 'A parte doce que vem no fim' }, { p: 'PUDIM', d: 'Doce de leite condensado com furinho' },
]

export interface CruzPalavra {
  numero: number
  palavra: string
  dica: string
  dir: 'H' | 'V'
  linha: number
  coluna: number
  cells: Array<[number, number]>
}

export interface CruzPuzzle {
  tam: number
  /** '' = célula bloqueada (não pertence a nenhuma palavra) */
  solucao: string[][]
  palavras: CruzPalavra[]
  seed: string
}

interface Tentativa {
  dir: 'H' | 'V'
  linha: number
  coluna: number
  cruzamentos: number
}

function cabe(grid: string[][], palavra: string, dir: 'H' | 'V', r0: number, c0: number): number | null {
  const dr = dir === 'V' ? 1 : 0
  const dc = dir === 'H' ? 1 : 0
  const rf = r0 + dr * (palavra.length - 1)
  const cf = c0 + dc * (palavra.length - 1)
  if (r0 < 0 || c0 < 0 || rf >= CRUZ_TAM || cf >= CRUZ_TAM) return null
  // célula antes e depois precisam estar fora ou vazias
  const antesR = r0 - dr
  const antesC = c0 - dc
  if (antesR >= 0 && antesC >= 0 && grid[antesR]?.[antesC]) return null
  const deposR = rf + dr
  const deposC = cf + dc
  if (deposR < CRUZ_TAM && deposC < CRUZ_TAM && grid[deposR]?.[deposC]) return null

  let cruzamentos = 0
  for (let k = 0; k < palavra.length; k++) {
    const r = r0 + dr * k
    const c = c0 + dc * k
    const atual = grid[r]![c]!
    if (atual) {
      if (atual !== palavra[k]) return null
      cruzamentos++
    } else {
      // célula nova: não pode encostar em palavra paralela
      const viz =
        dir === 'H'
          ? [grid[r - 1]?.[c], grid[r + 1]?.[c]]
          : [grid[r]?.[c - 1], grid[r]?.[c + 1]]
      if (viz.some(Boolean)) return null
    }
  }
  return cruzamentos
}

export function gerarCruzadinha(seed: string): CruzPuzzle {
  const rnd = mulberry32(hashSeed(`cruz:${seed}`))
  const escolhidas = embaralha(rnd, BANCO_CRUZADINHA).slice(0, CRUZ_QTD + 6) // sobras p/ pular
  escolhidas.sort((a, b) => b.p.length - a.p.length)

  const grid: string[][] = Array.from({ length: CRUZ_TAM }, () =>
    Array.from({ length: CRUZ_TAM }, () => ''),
  )
  const colocadas: Array<Omit<CruzPalavra, 'numero'>> = []

  const coloca = (v: CruzVerbete, dir: 'H' | 'V', r0: number, c0: number) => {
    const dr = dir === 'V' ? 1 : 0
    const dc = dir === 'H' ? 1 : 0
    const cells: Array<[number, number]> = []
    for (let k = 0; k < v.p.length; k++) {
      const r = r0 + dr * k
      const c = c0 + dc * k
      grid[r]![c] = v.p[k]!
      cells.push([r, c])
    }
    colocadas.push({ palavra: v.p, dica: v.d, dir, linha: r0, coluna: c0, cells })
  }

  // primeira no centro, horizontal
  const primeira = escolhidas[0]!
  coloca(primeira, 'H', Math.floor(CRUZ_TAM / 2), Math.floor((CRUZ_TAM - primeira.p.length) / 2))

  for (const v of escolhidas.slice(1)) {
    if (colocadas.length >= CRUZ_QTD) break
    let melhor: Tentativa | null = null
    // tenta cruzar cada letra da nova palavra com cada célula igual da grade
    for (let k = 0; k < v.p.length; k++) {
      for (let r = 0; r < CRUZ_TAM; r++) {
        for (let c = 0; c < CRUZ_TAM; c++) {
          if (grid[r]![c] !== v.p[k]) continue
          for (const dir of ['H', 'V'] as const) {
            const r0 = dir === 'V' ? r - k : r
            const c0 = dir === 'H' ? c - k : c
            const cruz = cabe(grid, v.p, dir, r0, c0)
            if (cruz !== null && cruz >= 1) {
              // maior nº de cruzamentos vence; empate decidido pela seed
              if (!melhor || cruz > melhor.cruzamentos || (cruz === melhor.cruzamentos && rnd() < 0.35)) {
                melhor = { dir, linha: r0, coluna: c0, cruzamentos: cruz }
              }
            }
          }
        }
      }
    }
    if (melhor) coloca(v, melhor.dir, melhor.linha, melhor.coluna)
  }

  // numeração estilo Coquetel: pela posição da 1ª letra (linha, depois coluna)
  colocadas.sort((a, b) => a.linha - b.linha || a.coluna - b.coluna || (a.dir === 'H' ? -1 : 1))
  const numeroPorInicio = new Map<string, number>()
  let proximo = 1
  const palavras: CruzPalavra[] = colocadas.map((p) => {
    const chave = `${p.linha}-${p.coluna}`
    if (!numeroPorInicio.has(chave)) numeroPorInicio.set(chave, proximo++)
    return { ...p, numero: numeroPorInicio.get(chave)! }
  })

  return { tam: CRUZ_TAM, solucao: grid, palavras, seed }
}
