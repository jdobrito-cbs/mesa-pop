/**
 * Mahjong Solitaire ("paciência de mahjong") — lógica pura e compartilhada.
 *
 * O jogador remove PARES de peças LIVRES (sem peça em cima e com um dos lados
 * aberto) até esvaziar o monte. A cada partida um DEAL novo e SEMPRE
 * RESOLVÍVEL: o tabuleiro é montado de trás para frente (reverse-solve) —
 * removendo pares de posições livres e atribuindo a elas peças que casam —,
 * então existe garantidamente uma ordem de remoção que zera tudo.
 *
 * Coordenadas em MEIAS-PEÇAS: cada peça ocupa 2×2 meias-células; camadas mais
 * altas entram deslocadas de 1 meia-célula (staddle) — daí o visual clássico.
 */

import { embaralha, hashSeed, intAte, mulberry32 } from './seed.js'

export type MahjongDificuldade = 'facil' | 'medio' | 'dificil'

export type MahjongSuit = 'char' | 'dot' | 'bam' | 'wind' | 'dragon' | 'flower' | 'season'

export interface MahjongTile {
  suit: MahjongSuit
  /** char/dot/bam: 1–9 · wind: 1–4 · dragon: 1–3 · flower/season: 1–4 */
  rank: number
}

/** posição de uma peça no tabuleiro (em meias-células) */
export interface MahjongSlot {
  id: number
  layer: number
  x: number
  y: number
}

export interface MahjongDeal {
  dificuldade: MahjongDificuldade
  slots: MahjongSlot[]
  /** peça em cada slot (index = slot.id) */
  tiles: MahjongTile[]
  /** uma ordem de remoção que resolve o tabuleiro (pares de slot ids) */
  solucao: Array<[number, number]>
  largura: number
  altura: number
}

/** duas peças casam? (flores casam com qualquer flor; estações idem) */
export function tilesMatch(a: MahjongTile, b: MahjongTile): boolean {
  if (a.suit !== b.suit) return false
  if (a.suit === 'flower' || a.suit === 'season') return true
  return a.rank === b.rank
}

/** camadas (base → topo) de cada nível: [largura, altura] em PEÇAS */
const LAYOUTS: Record<MahjongDificuldade, Array<[number, number]>> = {
  facil: [
    [8, 5],
    [7, 4],
  ],
  medio: [
    [9, 6],
    [8, 5],
    [7, 4],
  ],
  dificil: [
    [9, 6],
    [8, 5],
    [7, 4],
    [6, 3],
  ],
}

/**
 * Monta as posições do tabuleiro. Cada peça ocupa 2×2 meias-células; a base é
 * alinhada e cada camada acima entra deslocada de 1 meia-célula (staddle),
 * centralizada, formando uma pirâmide. Total sempre PAR (descarta 1 do topo
 * se necessário — pares exigem contagem par).
 */
export function montaLayout(dif: MahjongDificuldade): MahjongSlot[] {
  const camadas = LAYOUTS[dif]
  const [bw, bh] = camadas[0]!
  const baseW = bw * 2 // meias-células ocupadas pela base
  const baseH = bh * 2
  const slots: MahjongSlot[] = []
  let id = 0
  camadas.forEach(([w, h], layer) => {
    const larguraCamada = w * 2
    const alturaCamada = h * 2
    // centraliza a camada sobre a base (offset em meias-células, mantém staddle)
    let ox = Math.round((baseW - larguraCamada) / 2)
    let oy = Math.round((baseH - alturaCamada) / 2)
    // garante deslocamento ÍMPAR (staddle) em relação à base para camadas > 0
    if (layer > 0) {
      if (ox % 2 === 0) ox += 1
      if (oy % 2 === 0) oy += 1
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        slots.push({ id: id++, layer, x: ox + i * 2, y: oy + j * 2 })
      }
    }
  })
  // contagem par: pares exigem número par de peças
  if (slots.length % 2 === 1) slots.pop()
  return slots
}

// —— geometria de "peça livre" ——

/** a peça em `s` cobre a meia-célula (cx, cy)? (footprint 2×2) */
function cobre(s: MahjongSlot, cx: number, cy: number): boolean {
  return cx >= s.x && cx <= s.x + 1 && cy >= s.y && cy <= s.y + 1
}

/**
 * Peça livre = sem nenhuma peça POR CIMA (camada+1 sobrepondo) E com pelo
 * menos um lado (esquerda OU direita) aberto na mesma camada.
 */
export function slotLivre(alvo: MahjongSlot, presentes: MahjongSlot[]): boolean {
  for (const s of presentes) {
    if (s.id === alvo.id) continue
    if (s.layer === alvo.layer + 1) {
      // alguma célula do alvo coberta por s?
      if (
        cobre(s, alvo.x, alvo.y) ||
        cobre(s, alvo.x + 1, alvo.y) ||
        cobre(s, alvo.x, alvo.y + 1) ||
        cobre(s, alvo.x + 1, alvo.y + 1)
      ) {
        return false
      }
    }
  }
  let esq = false
  let dir = false
  for (const s of presentes) {
    if (s.id === alvo.id || s.layer !== alvo.layer) continue
    if (cobre(s, alvo.x - 1, alvo.y) || cobre(s, alvo.x - 1, alvo.y + 1)) esq = true
    if (cobre(s, alvo.x + 2, alvo.y) || cobre(s, alvo.x + 2, alvo.y + 1)) dir = true
  }
  return !esq || !dir
}

/** ids das peças livres, dado o conjunto de já removidas */
export function slotsLivres(slots: MahjongSlot[], removidas: Set<number>): number[] {
  const presentes = slots.filter((s) => !removidas.has(s.id))
  return presentes.filter((s) => slotLivre(s, presentes)).map((s) => s.id)
}

// —— saco de pares (144 peças = 72 pares) ——

function sacoDePares(): Array<[MahjongTile, MahjongTile]> {
  const pares: Array<[MahjongTile, MahjongTile]> = []
  const par = (t: MahjongTile) => pares.push([t, t], [t, t]) // 4 cópias = 2 pares
  for (const suit of ['char', 'dot', 'bam'] as const) for (let r = 1; r <= 9; r++) par({ suit, rank: r })
  for (let r = 1; r <= 4; r++) par({ suit: 'wind', rank: r })
  for (let r = 1; r <= 3; r++) par({ suit: 'dragon', rank: r })
  // flores/estações: 4 peças distintas por grupo, casam entre si → 2 pares
  pares.push([{ suit: 'flower', rank: 1 }, { suit: 'flower', rank: 2 }])
  pares.push([{ suit: 'flower', rank: 3 }, { suit: 'flower', rank: 4 }])
  pares.push([{ suit: 'season', rank: 1 }, { suit: 'season', rank: 2 }])
  pares.push([{ suit: 'season', rank: 3 }, { suit: 'season', rank: 4 }])
  return pares
}

/**
 * Deal RESOLVÍVEL por construção: esvazia o tabuleiro tirando pares de peças
 * livres e atribuindo a eles peças que casam (do saco embaralhado). A ordem de
 * remoção vira uma solução válida (cada par estava livre quando saiu).
 */
function tentaDeal(
  slots: MahjongSlot[],
  rnd: () => number,
): { tiles: MahjongTile[]; solucao: Array<[number, number]> } | null {
  const saco = embaralha(rnd, sacoDePares())
  const tiles: MahjongTile[] = new Array(slots.length)
  const solucao: Array<[number, number]> = []
  const removidas = new Set<number>()
  let usados = 0
  while (removidas.size < slots.length) {
    const livres = slotsLivres(slots, removidas)
    if (livres.length < 2) return null
    const a = livres[intAte(rnd, livres.length)]!
    let b = a
    while (b === a) b = livres[intAte(rnd, livres.length)]!
    const par = saco[usados++]
    if (!par) return null
    tiles[a] = par[0]
    tiles[b] = par[1]
    removidas.add(a)
    removidas.add(b)
    solucao.push([a, b])
  }
  return { tiles, solucao }
}

/** gera um tabuleiro novo e resolvível para a seed/dificuldade */
export function gerarMahjong(seed: string, dif: MahjongDificuldade): MahjongDeal {
  const rnd = mulberry32(hashSeed(`${seed}|${dif}`))
  const slots = montaLayout(dif)
  const largura = Math.max(...slots.map((s) => s.x)) + 2
  const altura = Math.max(...slots.map((s) => s.y)) + 2
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const r = tentaDeal(slots, rnd)
    if (r) return { dificuldade: dif, slots, tiles: r.tiles, solucao: r.solucao, largura, altura }
  }
  throw new Error('não foi possível gerar o mahjong (layout inválido)')
}

/** pares de peças LIVRES que casam agora (dica / detecção de travamento) */
export function movimentosPossiveis(deal: MahjongDeal, removidas: Set<number>): Array<[number, number]> {
  const livres = slotsLivres(deal.slots, removidas)
  const pares: Array<[number, number]> = []
  for (let i = 0; i < livres.length; i++) {
    for (let j = i + 1; j < livres.length; j++) {
      if (tilesMatch(deal.tiles[livres[i]!]!, deal.tiles[livres[j]!]!)) {
        pares.push([livres[i]!, livres[j]!])
      }
    }
  }
  return pares
}

/**
 * Reembaralha as peças que ainda estão na mesa para uma nova disposição
 * resolvível (para quando o jogo trava sem jogadas). Mantém as MESMAS peças,
 * só troca de lugar respeitando os slots ainda ocupados.
 */
export function reembaralhar(deal: MahjongDeal, removidas: Set<number>, seed: string): MahjongTile[] {
  const rnd = mulberry32(hashSeed(seed))
  const ocupados = deal.slots.filter((s) => !removidas.has(s.id))
  const restantes = ocupados.map((s) => deal.tiles[s.id]!)
  // reverse-solve nos slots restantes, distribuindo as peças que sobraram
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    const bolsa = embaralha(rnd, restantes)
    const novo = deal.tiles.slice()
    const removSim = new Set(removidas)
    const ordem: number[] = []
    let ok = true
    while (removSim.size < deal.slots.length) {
      const livres = slotsLivres(deal.slots, removSim)
      if (livres.length < 2) {
        ok = false
        break
      }
      const a = livres[intAte(rnd, livres.length)]!
      let b = a
      while (b === a) b = livres[intAte(rnd, livres.length)]!
      ordem.push(a, b)
      removSim.add(a)
      removSim.add(b)
    }
    if (!ok) continue
    // atribui pares casados às posições na ordem de saída
    const idxPar = casaEmPares(bolsa)
    if (!idxPar) continue
    for (let k = 0; k < ordem.length; k += 2) {
      novo[ordem[k]!] = idxPar[k / 2]![0]!
      novo[ordem[k + 1]!] = idxPar[k / 2]![1]!
    }
    return novo
  }
  return deal.tiles
}

/** agrupa uma lista PAR de peças em pares que casam (ou null se impossível) */
function casaEmPares(pecas: MahjongTile[]): Array<[MahjongTile, MahjongTile]> | null {
  const restam = [...pecas]
  const pares: Array<[MahjongTile, MahjongTile]> = []
  while (restam.length) {
    const a = restam.shift()!
    const jdx = restam.findIndex((b) => tilesMatch(a, b))
    if (jdx < 0) return null
    const b = restam.splice(jdx, 1)[0]!
    pares.push([a, b])
  }
  return pares
}

export const MAHJONG_BASE_PONTOS: Record<MahjongDificuldade, number> = {
  facil: 1200,
  medio: 2000,
  dificil: 3000,
}
