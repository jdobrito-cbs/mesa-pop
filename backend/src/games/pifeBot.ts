import { melhorBatida, type PifeCard } from '@mesapop/shared'
import type { PifeState } from './pife'
import type { PifeAction } from '@mesapop/shared'

/**
 * Bot do Pife — nível equilibrado. Só olha a própria mão + o topo do lixo.
 * Compra do lixo apenas quando a carta forma par/vizinho (senão do monte);
 * bate assim que a mão permite; senão descarta a carta menos útil.
 */

/** quanto uma carta "conversa" com as demais (trinca/sequência em potencial) */
function contribuicao(cards: PifeCard[], i: number): number {
  const c = cards[i]!
  let s = 0
  for (let j = 0; j < cards.length; j++) {
    if (j === i) continue
    const o = cards[j]!
    if (o.r === c.r) s += 3 // mesmo valor (trinca)
    if (o.s === c.s) {
      const d = Math.abs(o.r - c.r)
      if (d === 1) s += 2 // vizinho de sequência
      else if (d === 2) s += 1 // buraco de sequência
      // Ás alto: A(1) conversa com Q(12)/K(13) do mesmo naipe
      const alta =
        (c.r === 1 && (o.r === 13 || o.r === 12)) || (o.r === 1 && (c.r === 13 || c.r === 12))
      if (alta) s += o.r === 13 || c.r === 13 ? 2 : 1
    }
  }
  return s
}

export function choosePifeAction(state: PifeState, seat: number): PifeAction | null {
  if (state.fase === 'fim') return null
  if (state.turno !== seat) return null

  const mao = state.maos[seat] ?? []

  if (state.fase === 'comprando') {
    const topo = state.lixo[state.lixo.length - 1]
    if (topo) {
      const comTopo = [...mao, topo]
      // pega do lixo se a carta ao menos forma par/vizinho
      if (contribuicao(comTopo, comTopo.length - 1) >= 3) return { type: 'lixo' }
      // monte vazio e sem reciclagem possível: não há escolha a não ser o lixo
      if (state.monte.length === 0 && state.lixo.length <= 1) return { type: 'lixo' }
    }
    return { type: 'monte' }
  }

  // descartando: bate se der; senão joga fora a carta menos útil
  if (melhorBatida(mao, state.presaDoLixo)) return { type: 'bater' }

  let worst = -1
  let worstVal = Infinity
  for (let i = 0; i < mao.length; i++) {
    if (i === state.presaDoLixo) continue
    const v = contribuicao(mao, i)
    if (v < worstVal) {
      worstVal = v
      worst = i
    }
  }
  if (worst < 0) worst = state.presaDoLixo === 0 ? 1 : 0
  return { type: 'descartar', index: worst }
}
