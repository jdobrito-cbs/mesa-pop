/**
 * Truco — servidor autoritativo com mão escondida por assento.
 * O baralho, as mãos e a vira vivem aqui; cada jogador só recebe a
 * própria mão. Blefe acontece no chat da mesa. 😎
 */
import crypto from 'node:crypto'
import {
  manilhaRank,
  teamOf,
  vencedorMao,
  vencedorVaza,
  TRUCO_NAIPES,
  TRUCO_ORDEM,
  type TrucoCard,
  type TrucoFase,
  type TrucoMesaCarta,
  type TrucoView,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface TrucoState {
  players: number
  fase: TrucoFase
  maos: TrucoCard[][]
  vira: TrucoCard
  mesa: TrucoMesaCarta[]
  vazas: Array<number | null>
  turno: number
  /** quem abre a mão atual (roda a cada mão) */
  pe: number
  valor: number
  /** dupla que fez o ÚLTIMO pedido aceito (não pode aumentar em cima) */
  trucoTeam: number | null
  pendente: { paraTeam: number; novoValor: number; pedidoPor: number } | null
  /** quem devia jogar quando o truco foi pedido (para retomar) */
  turnoAntes: number
  placar: [number, number]
  ultimaMao: { team: number | null; valor: number; correu: boolean } | null
  vencedores: number[]
}

type TrucoAction =
  | { type: 'carta'; index: number }
  | { type: 'truco' }
  | { type: 'aceitar' }
  | { type: 'correr' }

const ALVO = 12

function baralho(): TrucoCard[] {
  const cards: TrucoCard[] = []
  for (const r of TRUCO_ORDEM) for (const s of TRUCO_NAIPES) cards.push({ r, s })
  // Fisher–Yates com crypto
  for (let i = cards.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
  }
  return cards
}

function distribui(s: TrucoState) {
  const deck = baralho()
  s.maos = Array.from({ length: s.players }, (_, i) => deck.slice(i * 3, i * 3 + 3))
  s.vira = deck[s.players * 3]!
  s.mesa = []
  s.vazas = []
  s.valor = 1
  s.trucoTeam = null
  s.pendente = null
  s.turno = s.pe
  s.fase = 'jogando'
}

export function initialTrucoState(players: number): TrucoState {
  const s: TrucoState = {
    players,
    fase: 'jogando',
    maos: [],
    vira: { r: '4', s: 'o' },
    mesa: [],
    vazas: [],
    turno: 0,
    pe: 0,
    valor: 1,
    trucoTeam: null,
    pendente: null,
    turnoAntes: 0,
    placar: [0, 0],
    ultimaMao: null,
    vencedores: [],
  }
  distribui(s)
  return s
}

function fechaMao(s: TrucoState, team: number | null, valor: number, correu: boolean) {
  if (team !== null) {
    s.placar[team as 0 | 1] += valor
  }
  s.ultimaMao = { team, valor, correu }
  if (s.placar[0] >= ALVO || s.placar[1] >= ALVO) {
    s.fase = 'fim'
    const win = s.placar[0] >= ALVO ? 0 : 1
    s.vencedores = Array.from({ length: s.players }, (_, i) => i).filter((i) => teamOf(i) === win)
    return
  }
  s.pe = (s.pe + 1) % s.players
  distribui(s)
}

export function aplicaTrucoAction(
  s: TrucoState,
  seat: number,
  action: TrucoAction,
): { error: string } | { state: TrucoState } {
  if (s.fase === 'fim') return { error: 'A partida já terminou' }
  const meuTeam = teamOf(seat)

  if (action.type === 'truco') {
    if (s.fase === 'respondendo') {
      // aumentar por cima: só a dupla que está respondendo
      if (meuTeam !== s.pendente!.paraTeam) return { error: 'Espere a resposta da outra dupla' }
      const novo = s.pendente!.novoValor + 3
      if (s.pendente!.novoValor >= ALVO) return { error: 'Já está no máximo' }
      s.pendente = { paraTeam: 1 - meuTeam, novoValor: Math.min(novo, ALVO), pedidoPor: seat }
      return { state: s }
    }
    if (s.valor >= ALVO) return { error: 'Já está valendo tudo' }
    if (s.trucoTeam === meuTeam) return { error: 'A outra dupla é quem pode aumentar agora' }
    s.turnoAntes = s.turno
    s.fase = 'respondendo'
    s.pendente = { paraTeam: 1 - meuTeam, novoValor: s.valor === 1 ? 3 : s.valor + 3, pedidoPor: seat }
    return { state: s }
  }

  if (action.type === 'aceitar') {
    if (s.fase !== 'respondendo' || meuTeam !== s.pendente!.paraTeam) {
      return { error: 'Nada para aceitar' }
    }
    s.valor = s.pendente!.novoValor
    s.trucoTeam = 1 - meuTeam
    s.pendente = null
    s.fase = 'jogando'
    s.turno = s.turnoAntes
    return { state: s }
  }

  if (action.type === 'correr') {
    if (s.fase !== 'respondendo' || meuTeam !== s.pendente!.paraTeam) {
      return { error: 'Nada para correr' }
    }
    // quem corre entrega o valor ANTERIOR à proposta
    const ganho = s.pendente!.novoValor === 3 ? 1 : s.pendente!.novoValor - 3
    fechaMao(s, 1 - meuTeam, Math.max(ganho, 1), true)
    return { state: s }
  }

  if (action.type === 'carta') {
    if (s.fase !== 'jogando') return { error: 'Responda o truco primeiro!' }
    if (s.turno !== seat) return { error: 'Não é a sua vez' }
    const mao = s.maos[seat]!
    const card = mao[action.index]
    if (!card) return { error: 'Carta inválida' }
    mao.splice(action.index, 1)
    s.mesa.push({ seat, card })

    if (s.mesa.length >= s.players) {
      // vaza completa
      const team = vencedorVaza(s.mesa, s.vira)
      s.vazas.push(team)
      const resultado = vencedorMao(s.vazas)
      if (resultado !== undefined) {
        fechaMao(s, resultado, resultado === null ? 0 : s.valor, false)
        return { state: s }
      }
      // próxima vaza: abre a MAIOR carta do time vencedor (empate → quem abriu)
      let melhorSeat = s.mesa[0]!.seat
      let melhorForca = -1
      for (const m of s.mesa) {
        if (team !== null && teamOf(m.seat) !== team) continue
        const f = forca(m.card, s.vira)
        if (f > melhorForca) {
          melhorForca = f
          melhorSeat = m.seat
        }
      }
      s.turno = team === null ? s.mesa[0]!.seat : melhorSeat
      s.mesa = []
    } else {
      s.turno = (s.turno + 1) % s.players
    }
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

// força local (evita import circular no helper acima)
function forca(card: TrucoCard, vira: TrucoCard): number {
  if (card.r === manilhaRank(vira)) return 100 + TRUCO_NAIPES.indexOf(card.s)
  return TRUCO_ORDEM.indexOf(card.r)
}

export function trucoViewFor(s: TrucoState, seat: number): TrucoView {
  return {
    fase: s.fase,
    players: s.players,
    minhaMao: seat >= 0 ? (s.maos[seat] ?? []) : [],
    cartasRestantes: s.maos.map((m) => m.length),
    mesa: s.mesa,
    vira: s.vira,
    manilha: manilhaRank(s.vira),
    turno: s.turno,
    valor: s.pendente?.novoValor && s.fase === 'respondendo' ? s.valor : s.valor,
    pendente: s.pendente,
    vazas: s.vazas,
    placar: s.placar,
    ultimaMao: s.ultimaMao,
    vencedores: s.vencedores,
    meuTeam: seat >= 0 ? teamOf(seat) : -1,
  }
}

export const trucoModule: GameModule<TrucoState, TrucoAction> = {
  slug: 'truco',
  minPlayers: 2,
  maxPlayers: 4,
  validPlayerCounts: [2, 4], // 1×1 ou duplas — nunca 3
  seatPicking: true,
  allowSpectators: true,
  rotation: true,

  init(playerCount) {
    return initialTrucoState(playerCount)
  },

  play(state, seat, action) {
    return aplicaTrucoAction(state, seat, action)
  },

  getStateFor(state, seat) {
    return trucoViewFor(state, seat)
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedores,
      draw: false,
    }
  },
}
