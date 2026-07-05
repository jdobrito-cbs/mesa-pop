/**
 * Pife — servidor autoritativo com mão escondida por assento.
 * O baralho duplo, as mãos e o monte vivem aqui; cada jogador só recebe
 * a própria mão. O servidor valida compra, descarte e a batida.
 */
import crypto from 'node:crypto'
import {
  melhorBatida,
  PIFE_NAIPES,
  type PifeAction,
  type PifeCard,
  type PifeFase,
  type PifeView,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface PifeState {
  players: number
  fase: PifeFase
  maos: PifeCard[][]
  monte: PifeCard[]
  lixo: PifeCard[]
  turno: number
  /** índice (na mão) da carta comprada do lixo nesta jogada */
  presaDoLixo: number | null
  vencedor: number | null
  gruposVencedores: PifeCard[][] | null
}

function baralhoDuplo(): PifeCard[] {
  const cards: PifeCard[] = []
  for (let copia = 0; copia < 2; copia++) {
    for (const s of PIFE_NAIPES) for (let r = 1; r <= 13; r++) cards.push({ r, s })
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
  }
  return cards
}

export function initialPifeState(players: number): PifeState {
  const deck = baralhoDuplo()
  const maos = Array.from({ length: players }, (_, i) => deck.slice(i * 9, i * 9 + 9))
  const resto = deck.slice(players * 9)
  return {
    players,
    fase: 'comprando',
    maos,
    monte: resto.slice(1),
    lixo: [resto[0]!],
    turno: 0,
    presaDoLixo: null,
    vencedor: null,
    gruposVencedores: null,
  }
}

export function aplicaPifeAction(
  s: PifeState,
  seat: number,
  action: PifeAction,
): { error: string } | { state: PifeState } {
  if (s.fase === 'fim') return { error: 'A partida já terminou' }
  if (s.turno !== seat) return { error: 'Não é a sua vez' }
  const mao = s.maos[seat]!

  if (action.type === 'monte' || action.type === 'lixo') {
    if (s.fase !== 'comprando') return { error: 'Você já comprou — descarte uma carta' }
    if (action.type === 'lixo') {
      const carta = s.lixo.pop()
      if (!carta) return { error: 'O lixo está vazio' }
      mao.push(carta)
      s.presaDoLixo = mao.length - 1
    } else {
      if (s.monte.length === 0) {
        // recicla o lixo embaralhado (menos o topo, que continua à mostra)
        if (s.lixo.length <= 1) return { error: 'Acabaram as cartas!' }
        const topo = s.lixo.pop()!
        s.monte = s.lixo
        s.lixo = [topo]
        for (let i = s.monte.length - 1; i > 0; i--) {
          const j = crypto.randomInt(i + 1)
          ;[s.monte[i], s.monte[j]] = [s.monte[j]!, s.monte[i]!]
        }
      }
      mao.push(s.monte.pop()!)
      s.presaDoLixo = null
    }
    s.fase = 'descartando'
    return { state: s }
  }

  if (action.type === 'descartar') {
    if (s.fase !== 'descartando') return { error: 'Compre uma carta primeiro' }
    if (action.index === s.presaDoLixo) {
      return { error: 'Essa acabou de sair do lixo — descarte outra' }
    }
    const carta = mao[action.index]
    if (!carta) return { error: 'Carta inválida' }
    mao.splice(action.index, 1)
    s.lixo.push(carta)
    s.presaDoLixo = null
    s.turno = (s.turno + 1) % s.players
    s.fase = 'comprando'
    return { state: s }
  }

  if (action.type === 'bater') {
    if (s.fase !== 'descartando') return { error: 'Compre uma carta antes de bater' }
    const batida = melhorBatida(mao, s.presaDoLixo)
    if (!batida) return { error: 'Sua mão ainda não bate!' }
    const descartada = mao.splice(batida.descarte, 1)[0]!
    s.lixo.push(descartada)
    s.vencedor = seat
    s.gruposVencedores = batida.grupos
    s.fase = 'fim'
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

export function pifeViewFor(s: PifeState, seat: number): PifeView {
  const minha = seat >= 0 ? (s.maos[seat] ?? []) : []
  return {
    fase: s.fase,
    players: s.players,
    minhaMao: minha,
    cartasRestantes: s.maos.map((m) => m.length),
    monte: s.monte.length,
    lixoTopo: s.lixo[s.lixo.length - 1] ?? null,
    lixo: s.lixo.length,
    turno: s.turno,
    presaDoLixo: seat === s.turno ? s.presaDoLixo : null,
    podeBater:
      seat === s.turno && s.fase === 'descartando' && melhorBatida(minha, s.presaDoLixo) !== null,
    vencedor: s.vencedor,
    gruposVencedores: s.fase === 'fim' ? s.gruposVencedores : null,
  }
}

export const pifeModule: GameModule<PifeState, PifeAction> = {
  slug: 'pife',
  minPlayers: 2,
  maxPlayers: 4,
  allowSpectators: true,
  rotation: true,

  init(playerCount) {
    return initialPifeState(playerCount)
  },

  play(state, seat, action) {
    if (!action || !['monte', 'lixo', 'descartar', 'bater'].includes(action.type)) {
      return { error: 'Jogada inválida' }
    }
    return aplicaPifeAction(state, seat, action)
  },

  // MÃO ESCONDIDA: cada assento só recebe a própria mão + contagens.
  getStateFor(state, seat) {
    return pifeViewFor(state, seat)
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedor !== null ? [state.vencedor] : [],
      draw: false,
    }
  },
}
