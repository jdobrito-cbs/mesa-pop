/**
 * Truco (paulista) — regras puras e compartilhadas.
 * Baralho de 40 (sem 8, 9 e 10). Uma carta "vira"; as manilhas são o
 * rank SEGUINTE ao da vira, com força por naipe: paus > copas > espadas
 * > ouros. Mão = melhor de 3 vazas; truco escala 1→3→6→9→12; correr
 * entrega o valor anterior. Partida até 12 tentos.
 * 2 jogadores (1×1) ou 4 (duplas 0+2 × 1+3). MÃO ESCONDIDA por assento.
 * (Mão de onze/ferro: melhoria futura anotada.)
 */

export type TrucoNaipe = 'o' | 'e' | 'c' | 'p' // ouros, espadas, copas, paus
export type TrucoRank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3'

export interface TrucoCard {
  r: TrucoRank
  s: TrucoNaipe
}

export const TRUCO_ORDEM: TrucoRank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']
export const TRUCO_NAIPES: TrucoNaipe[] = ['o', 'e', 'c', 'p'] // força crescente

export function manilhaRank(vira: TrucoCard): TrucoRank {
  const i = TRUCO_ORDEM.indexOf(vira.r)
  return TRUCO_ORDEM[(i + 1) % TRUCO_ORDEM.length]!
}

/** força absoluta da carta na mão atual (manilha esmaga tudo) */
export function forcaCarta(card: TrucoCard, vira: TrucoCard): number {
  if (card.r === manilhaRank(vira)) return 100 + TRUCO_NAIPES.indexOf(card.s)
  return TRUCO_ORDEM.indexOf(card.r)
}

export interface TrucoMesaCarta {
  seat: number
  card: TrucoCard
}

export type TrucoFase = 'jogando' | 'respondendo' | 'fim'

/** visão filtrada por assento — só a PRÓPRIA mão trafega */
export interface TrucoView {
  fase: TrucoFase
  players: number
  minhaMao: TrucoCard[]
  cartasRestantes: number[]
  mesa: TrucoMesaCarta[]
  vira: TrucoCard
  manilha: TrucoRank
  turno: number
  valor: number
  /** truco pendente: dupla que precisa responder + valor proposto */
  pendente: { paraTeam: number; novoValor: number; pedidoPor: number } | null
  vazas: Array<number | null>
  placar: [number, number]
  /** última mão fechada (para exibir o "+N tentos") */
  ultimaMao: { team: number | null; valor: number; correu: boolean } | null
  vencedores: number[]
  meuTeam: number
}

export const teamOf = (seat: number) => seat % 2

/** resolve a vaza: retorna o TIME vencedor ou null (empate entre times) */
export function vencedorVaza(mesa: TrucoMesaCarta[], vira: TrucoCard): number | null {
  let melhor = -1
  let melhorSeat = -1
  let empate = false
  for (const jogada of mesa) {
    const f = forcaCarta(jogada.card, vira)
    if (f > melhor) {
      melhor = f
      melhorSeat = jogada.seat
      empate = false
    } else if (f === melhor && teamOf(jogada.seat) !== teamOf(melhorSeat)) {
      empate = true
    }
  }
  return empate ? null : teamOf(melhorSeat)
}

/**
 * decide a mão pelas vazas jogadas (null = empate na vaza):
 * 2 vitórias fecham; empate dá a mão a quem já venceu (ou ao vencedor
 * seguinte); tudo empatado = mão anulada (retorna undefined até dar).
 */
export function vencedorMao(vazas: Array<number | null>): number | null | undefined {
  const wins = [0, 0]
  for (const v of vazas) {
    if (v !== null) wins[v]!++
  }
  if (wins[0]! >= 2) return 0
  if (wins[1]! >= 2) return 1
  // houve empate em alguma vaza: o primeiro time a vencer QUALQUER vaza leva
  if (vazas.includes(null)) {
    const primeira = vazas.find((v) => v !== null)
    if (primeira !== undefined && primeira !== null) return primeira
    if (vazas.length >= 3) return null // tudo empatado: mão anulada
  }
  if (vazas.length >= 3) {
    if (wins[0]! > wins[1]!) return 0
    if (wins[1]! > wins[0]!) return 1
    return null
  }
  return undefined // mão ainda em jogo
}
