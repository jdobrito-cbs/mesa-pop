/**
 * Pife (pif-paf) — regras puras e compartilhadas.
 * 2 baralhos (104 cartas), 2–4 jogadores, 9 cartas cada. No seu turno:
 * compra do MONTE ou do topo do LIXO e descarta 1. Bate quem, após
 * comprar (10 cartas), consegue descartar 1 e formar com as 9 restantes
 * TRÊS jogos de três: TRINCA (mesmo valor) ou SEQUÊNCIA de 3 do MESMO
 * naipe (A baixa A-2-3 ou alta Q-K-A; sem virar a esquina). Quem comprou
 * do lixo não pode descartar a mesma carta na mesma jogada.
 * MÃO ESCONDIDA por assento.
 */

export type PifeNaipe = 'o' | 'e' | 'c' | 'p' // ouros, espadas, copas, paus

export interface PifeCard {
  /** 1 (Ás) .. 13 (Rei) */
  r: number
  s: PifeNaipe
}

export const PIFE_NAIPES: PifeNaipe[] = ['o', 'e', 'c', 'p']

export type PifeFase = 'comprando' | 'descartando' | 'fim'

export type PifeAction =
  | { type: 'monte' }
  | { type: 'lixo' }
  | { type: 'descartar'; index: number }
  | { type: 'bater' }

/** visão filtrada por assento — só a PRÓPRIA mão trafega */
export interface PifeView {
  fase: PifeFase
  players: number
  minhaMao: PifeCard[]
  cartasRestantes: number[]
  monte: number
  lixoTopo: PifeCard | null
  lixo: number
  turno: number
  /** índice da carta recém-comprada do lixo (não pode ser descartada) */
  presaDoLixo: number | null
  /** a mão atual (10 cartas) já bate? (calculado no servidor) */
  podeBater: boolean
  vencedor: number | null
  /** os 3 jogos do vencedor, revelados só no fim */
  gruposVencedores: PifeCard[][] | null
}

export function isTrinca(cards: PifeCard[]): boolean {
  return cards.length === 3 && cards.every((c) => c.r === cards[0]!.r)
}

export function isSequencia(cards: PifeCard[]): boolean {
  if (cards.length !== 3) return false
  if (!cards.every((c) => c.s === cards[0]!.s)) return false
  const rs = cards.map((c) => c.r).sort((a, b) => a - b)
  // corrida normal (A baixa inclusa: 1-2-3)
  if (rs[1] === rs[0]! + 1 && rs[2] === rs[1]! + 1) return true
  // A alta: Q-K-A → [1, 12, 13]
  return rs[0] === 1 && rs[1] === 12 && rs[2] === 13
}

export function isJogo(cards: PifeCard[]): boolean {
  return isTrinca(cards) || isSequencia(cards)
}

/** tenta partir 9 cartas em 3 jogos de 3; retorna os grupos ou null */
export function particiona9(cards: PifeCard[]): PifeCard[][] | null {
  if (cards.length !== 9) return null
  const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  // escolhe 3 índices para o 1º grupo (fixa o 0 nele p/ evitar repetição)
  for (let a1 = 1; a1 < 8; a1++) {
    for (let a2 = a1 + 1; a2 < 9; a2++) {
      const g1 = [0, a1, a2]
      if (!isJogo(g1.map((i) => cards[i]!))) continue
      const resto = idx.filter((i) => !g1.includes(i))
      // escolhe 3 dos 6 restantes (fixa o primeiro)
      for (let b1 = 1; b1 < 5; b1++) {
        for (let b2 = b1 + 1; b2 < 6; b2++) {
          const g2 = [resto[0]!, resto[b1]!, resto[b2]!]
          if (!isJogo(g2.map((i) => cards[i]!))) continue
          const g3 = resto.filter((i) => !g2.includes(i))
          if (isJogo(g3.map((i) => cards[i]!))) {
            return [g1, g2, g3].map((g) => g.map((i) => cards[i]!))
          }
        }
      }
    }
  }
  return null
}

/**
 * com 10 cartas na mão: existe um descarte que deixa 3 jogos?
 * Retorna { descarte (índice), grupos } ou null.
 */
export function melhorBatida(
  cards: PifeCard[],
  descarteProibido: number | null = null,
): { descarte: number; grupos: PifeCard[][] } | null {
  if (cards.length !== 10) return null
  for (let d = 0; d < 10; d++) {
    if (d === descarteProibido) continue
    const grupos = particiona9(cards.filter((_, i) => i !== d))
    if (grupos) return { descarte: d, grupos }
  }
  return null
}
