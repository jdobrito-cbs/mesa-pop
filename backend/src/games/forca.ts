/**
 * Forca — servidor autoritativo: a palavra escolhida NUNCA trafega para
 * quem adivinha (só as letras reveladas). Cada jogador escolhe a palavra
 * numa rodada; os outros se revezam chutando letras. Acertou a letra,
 * continua; errou, a forca cresce e a vez passa.
 */
import {
  FORCA_MAX_ERROS,
  normalizaForca,
  type ForcaAction,
  type ForcaFase,
  type ForcaView,
} from '@mesapop/shared'
import type { GameModule } from './module'
import { chooseForcaMove } from './forcaBot'

export interface ForcaState {
  players: number
  fase: ForcaFase
  rodada: number
  escolhedor: number
  palavra: string // SEGREDO
  reveladas: boolean[]
  letrasCertas: string[]
  letrasErradas: string[]
  erros: number
  turno: number
  pontos: number[]
  ultimoEvento: string | null
  vencedores: number[]
}

const PONTOS_LETRA = 10 // por ocorrência revelada
const PONTOS_ERRO_ESCOLHEDOR = 8
const BONUS_COMPLETAR = 40
const BONUS_CHUTE = 60
const BONUS_ENFORCOU = 50

function proximoAdivinhador(s: ForcaState, aPartirDe: number): number {
  let seat = aPartirDe
  do {
    seat = (seat + 1) % s.players
  } while (seat === s.escolhedor)
  return seat
}

export function initialForcaState(players: number): ForcaState {
  return {
    players,
    fase: 'escolhendo',
    rodada: 0,
    escolhedor: 0,
    palavra: '',
    reveladas: [],
    letrasCertas: [],
    letrasErradas: [],
    erros: 0,
    turno: 1 % players,
    pontos: Array.from({ length: players }, () => 0),
    ultimoEvento: null,
    vencedores: [],
  }
}

function fechaRodada(s: ForcaState) {
  s.rodada++
  if (s.rodada >= s.players) {
    s.fase = 'fim'
    const max = Math.max(...s.pontos)
    s.vencedores = s.pontos.map((p, i) => (p === max ? i : -1)).filter((i) => i >= 0)
    return
  }
  s.escolhedor = (s.escolhedor + 1) % s.players
  s.fase = 'escolhendo'
  s.palavra = ''
  s.reveladas = []
  s.letrasCertas = []
  s.letrasErradas = []
  s.erros = 0
  s.turno = proximoAdivinhador(s, s.escolhedor)
}

export function aplicaForcaAction(
  s: ForcaState,
  seat: number,
  action: ForcaAction,
): { error: string } | { state: ForcaState } {
  if (s.fase === 'fim') return { error: 'A partida já terminou' }

  if (action.type === 'palavra') {
    if (s.fase !== 'escolhendo') return { error: 'A rodada já começou' }
    if (seat !== s.escolhedor) return { error: 'Quem escolhe agora é outro jogador' }
    const palavra = normalizaForca(action.palavra ?? '')
    if (palavra.length < 3 || palavra.length > 16) {
      return { error: 'A palavra precisa ter de 3 a 16 letras' }
    }
    s.palavra = palavra
    s.reveladas = Array.from({ length: palavra.length }, () => false)
    s.letrasCertas = []
    s.letrasErradas = []
    s.erros = 0
    s.fase = 'jogando'
    s.turno = proximoAdivinhador(s, s.escolhedor)
    s.ultimoEvento = `Palavra escolhida: ${palavra.length} letras. Boa sorte!`
    return { state: s }
  }

  if (s.fase !== 'jogando') return { error: 'Esperando a palavra ser escolhida' }
  if (seat === s.escolhedor) return { error: 'Você escolheu a palavra — agora é só torcer!' }
  if (seat !== s.turno) return { error: 'Não é a sua vez' }

  if (action.type === 'letra') {
    const letra = normalizaForca(action.letra ?? '').slice(0, 1)
    if (!letra) return { error: 'Letra inválida' }
    if (s.letrasCertas.includes(letra) || s.letrasErradas.includes(letra)) {
      return { error: 'Essa letra já foi tentada' }
    }
    let acertos = 0
    for (let i = 0; i < s.palavra.length; i++) {
      if (s.palavra[i] === letra && !s.reveladas[i]) {
        s.reveladas[i] = true
        acertos++
      }
    }
    if (acertos > 0) {
      s.letrasCertas.push(letra)
      s.pontos[seat]! += acertos * PONTOS_LETRA
      s.ultimoEvento = `${letra} apareceu ${acertos}×!`
      if (s.reveladas.every(Boolean)) {
        s.pontos[seat]! += BONUS_COMPLETAR
        s.ultimoEvento = `A palavra era ${s.palavra}! +${BONUS_COMPLETAR} de bônus`
        fechaRodada(s)
      }
      // acertou: joga de novo (turno não muda)
    } else {
      s.letrasErradas.push(letra)
      s.erros++
      s.pontos[s.escolhedor]! += PONTOS_ERRO_ESCOLHEDOR
      s.ultimoEvento = `Não tem ${letra}…`
      if (s.erros >= FORCA_MAX_ERROS) {
        s.pontos[s.escolhedor]! += BONUS_ENFORCOU
        s.ultimoEvento = `Enforcou! A palavra era ${s.palavra}.`
        fechaRodada(s)
      } else {
        s.turno = proximoAdivinhador(s, seat)
      }
    }
    return { state: s }
  }

  if (action.type === 'chute') {
    const chute = normalizaForca(action.palavra ?? '')
    if (!chute) return { error: 'Chute inválido' }
    if (chute === s.palavra) {
      const ocultas = s.reveladas.filter((r) => !r).length
      s.reveladas = s.reveladas.map(() => true)
      s.pontos[seat]! += BONUS_CHUTE + ocultas * 2
      s.ultimoEvento = `CHUTE CERTEIRO: ${s.palavra}! +${BONUS_CHUTE}`
      fechaRodada(s)
    } else {
      s.erros++
      s.pontos[s.escolhedor]! += PONTOS_ERRO_ESCOLHEDOR
      s.ultimoEvento = 'Chute errado — a forca cresceu!'
      if (s.erros >= FORCA_MAX_ERROS) {
        s.pontos[s.escolhedor]! += BONUS_ENFORCOU
        s.ultimoEvento = `Enforcou! A palavra era ${s.palavra}.`
        fechaRodada(s)
      } else {
        s.turno = proximoAdivinhador(s, seat)
      }
    }
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

export function forcaViewFor(s: ForcaState, seat: number): ForcaView {
  const veTudo = seat === s.escolhedor || s.fase === 'fim'
  return {
    fase: s.fase,
    players: s.players,
    rodada: s.rodada,
    totalRodadas: s.players,
    escolhedor: s.escolhedor,
    palavraVista:
      s.fase === 'escolhendo'
        ? []
        : [...s.palavra].map((letra, i) => (veTudo || s.reveladas[i] ? letra : null)),
    letrasErradas: s.letrasErradas,
    letrasCertas: s.letrasCertas,
    erros: s.erros,
    maxErros: FORCA_MAX_ERROS,
    turno: s.turno,
    pontos: s.pontos,
    ultimoEvento: s.ultimoEvento,
    vencedores: s.vencedores,
  }
}

export const forcaModule: GameModule<ForcaState, ForcaAction> = {
  slug: 'forca',
  minPlayers: 2,
  maxPlayers: 6,
  allowSpectators: true,

  init(playerCount) {
    return initialForcaState(playerCount)
  },

  play(state, seat, action) {
    if (!action || !['palavra', 'letra', 'chute'].includes(action.type)) {
      return { error: 'Jogada inválida' }
    }
    return aplicaForcaAction(state, seat, action)
  },

  // A PALAVRA NUNCA VAZA: quem adivinha recebe null nas letras ocultas.
  getStateFor(state, seat) {
    return forcaViewFor(state, seat)
  },

  currentSeat(state) {
    if (state.fase === 'fim') return null
    return state.fase === 'escolhendo' ? state.escolhedor : state.turno
  },

  bot(state, seat) {
    return chooseForcaMove(state, seat)
  },

  scoresFor(state) {
    return state.pontos
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedores,
      draw: state.fase === 'fim' && state.vencedores.length === state.players,
    }
  },
}
