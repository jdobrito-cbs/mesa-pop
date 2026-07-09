import { manilhaRank, teamOf, TRUCO_NAIPES, TRUCO_ORDEM, type TrucoCard } from '@mesapop/shared'
import type { TrucoAction, TrucoState } from './truco'

/**
 * Bot do Truco — nível equilibrado. Só olha a PRÓPRIA mão + a vira/mesa
 * (públicas). Avalia a força (manilhas + cartas altas) para pedir truco,
 * aceitar/aumentar/correr, e escolhe a carta (menor que vence, ou descarta).
 */

function forca(card: TrucoCard, vira: TrucoCard): number {
  if (card.r === manilhaRank(vira)) return 100 + TRUCO_NAIPES.indexOf(card.s)
  return TRUCO_ORDEM.indexOf(card.r)
}

export function chooseTrucoMove(s: TrucoState, seat: number): TrucoAction | null {
  if (s.fase === 'fim') return null
  const meuTeam = teamOf(seat)
  const mao = s.maos[seat] ?? []
  const fs = mao.map((c) => forca(c, s.vira))
  const manilhas = fs.filter((f) => f >= 100).length
  const altas = fs.filter((f) => f >= 7 && f < 100).length // A, 2, 3
  const forcaMao = manilhas * 2 + altas

  if (s.fase === 'respondendo') {
    if (!s.pendente || meuTeam !== s.pendente.paraTeam) return null
    if (forcaMao >= 4 && s.pendente.novoValor < 12 && Math.random() < 0.4) return { type: 'truco' }
    if (forcaMao >= 2) return { type: 'aceitar' }
    if (forcaMao === 1 && Math.random() < 0.5) return { type: 'aceitar' }
    return { type: 'correr' }
  }

  // fase 'jogando'
  if (s.turno !== seat) return null

  // pede truco com mão forte (no começo da vaza)
  if (forcaMao >= 3 && s.valor < 12 && s.trucoTeam !== meuTeam && s.mesa.length === 0 && Math.random() < 0.35) {
    return { type: 'truco' }
  }

  const ordenado = mao.map((c, i) => ({ i, f: forca(c, s.vira) })).sort((a, b) => a.f - b.f) // fraca → forte
  if (ordenado.length === 0) return null

  if (s.mesa.length === 0) {
    // liderando: joga uma carta mediana (guarda a manilha)
    const meio = ordenado[Math.floor(ordenado.length / 2)] ?? ordenado[0]!
    return { type: 'carta', index: meio.i }
  }

  // seguindo: se o parceiro já está ganhando a vaza, descarta a mais fraca
  const melhorMesa = s.mesa.reduce((b, m) => (forca(m.card, s.vira) > forca(b.card, s.vira) ? m : b))
  if (teamOf(melhorMesa.seat) === meuTeam) return { type: 'carta', index: ordenado[0]!.i }

  // senão, joga a MENOR carta que vence; se não vencer, descarta a mais fraca
  const melhorForca = forca(melhorMesa.card, s.vira)
  const vence = ordenado.find((x) => x.f > melhorForca)
  return { type: 'carta', index: (vence ?? ordenado[0]!).i }
}
