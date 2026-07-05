/**
 * Desenha & Adivinha — servidor AUTORITATIVO do party de desenho:
 * o desenhista digita a palavra (fica oculta) e desenha; os outros
 * palpitam no chat de RESPOSTAS do jogo. Palpite certo NUNCA é ecoado —
 * vira "acertou!". A vez roda; ao fim das rodadas, vence quem pontuou +.
 */
import {
  dicaDe,
  normalizaPalavra,
  DESENHA_RODADAS_POR_JOGADOR,
  DESENHA_TEMPO_ESCOLHA,
  DESENHA_TEMPO_REVELACAO,
  DESENHA_TEMPO_RODADA,
  type DesenhaFase,
  type DesenhaStroke,
  type DesenhaView,
  type RespostaEntry,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface DesenhaState {
  players: number
  fase: DesenhaFase
  rodada: number
  totalRodadas: number
  desenhista: number
  palavra: string | null
  tempo: number
  strokes: DesenhaStroke[]
  scores: number[]
  acertaram: number[]
  respostas: RespostaEntry[]
  vencedores: number[]
}

type DesenhaAction =
  | { type: 'palavra'; palavra: string }
  | { type: 'traco'; color: string; size: number; pts: number[] }
  | { type: 'limpar' }
  | { type: 'palpite'; texto: string }

const MAX_STROKES = 600
const MAX_PTS = 512
const MAX_RESPOSTAS = 40

export function initialDesenhaState(players: number): DesenhaState {
  return {
    players,
    fase: 'escolhendo',
    rodada: 1,
    totalRodadas: players * DESENHA_RODADAS_POR_JOGADOR,
    desenhista: 0,
    palavra: null,
    tempo: DESENHA_TEMPO_ESCOLHA,
    strokes: [],
    scores: Array.from({ length: players }, () => 0),
    acertaram: [],
    respostas: [],
    vencedores: [],
  }
}

function proximaRodada(s: DesenhaState) {
  if (s.rodada >= s.totalRodadas) {
    s.fase = 'fim'
    const max = Math.max(...s.scores)
    s.vencedores = s.scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0)
    return
  }
  s.rodada++
  s.desenhista = (s.desenhista + 1) % s.players
  s.palavra = null
  s.strokes = []
  s.acertaram = []
  s.fase = 'escolhendo'
  s.tempo = DESENHA_TEMPO_ESCOLHA
}

export function aplicaDesenhaAction(
  s: DesenhaState,
  seat: number,
  action: DesenhaAction,
): { error: string } | { state: DesenhaState } {
  if (s.fase === 'fim') return { error: 'A partida já terminou' }

  if (action.type === 'palavra') {
    if (seat !== s.desenhista) return { error: 'Só quem desenha escolhe a palavra' }
    if (s.fase !== 'escolhendo') return { error: 'A palavra já foi escolhida' }
    const palavra = String(action.palavra ?? '').trim()
    if (palavra.length < 2 || palavra.length > 30) {
      return { error: 'A palavra precisa ter de 2 a 30 letras' }
    }
    s.palavra = palavra
    s.fase = 'desenhando'
    s.tempo = DESENHA_TEMPO_RODADA
    return { state: s }
  }

  if (action.type === 'traco') {
    if (seat !== s.desenhista) return { error: 'Só quem desenha risca a tela' }
    if (s.fase !== 'desenhando') return { error: 'Ainda não é hora de desenhar' }
    const pts = Array.isArray(action.pts) ? action.pts.slice(0, MAX_PTS).map((n) => Math.round(Number(n) || 0)) : []
    if (pts.length < 2 || s.strokes.length >= MAX_STROKES) return { state: s }
    s.strokes.push({
      color: String(action.color ?? '#140E26').slice(0, 24),
      size: Math.min(Math.max(Number(action.size) || 4, 2), 30),
      pts,
    })
    return { state: s }
  }

  if (action.type === 'limpar') {
    if (seat !== s.desenhista) return { error: 'Só quem desenha limpa a tela' }
    s.strokes = []
    return { state: s }
  }

  if (action.type === 'palpite') {
    if (seat === s.desenhista) return { error: 'Quem desenha não palpita 😉' }
    if (s.fase !== 'desenhando') return { error: 'Espere a rodada começar' }
    if (s.acertaram.includes(seat)) return { error: 'Você já acertou — segure o spoiler!' }
    const texto = String(action.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!texto) return { error: 'Escreva um palpite' }

    if (normalizaPalavra(texto) === normalizaPalavra(s.palavra!)) {
      // acertou! pontos por ordem de acerto; desenhista também ganha
      const ordem = s.acertaram.length
      s.acertaram.push(seat)
      s.scores[seat] = (s.scores[seat] ?? 0) + Math.max(100 - ordem * 20, 40)
      s.scores[s.desenhista] = (s.scores[s.desenhista] ?? 0) + 25
      s.respostas.push({ seat, text: null, acertou: true }) // a palavra NÃO é ecoada
      // todos os adivinhadores acertaram → revela e roda a vez
      if (s.acertaram.length >= s.players - 1) {
        s.fase = 'revelacao'
        s.tempo = DESENHA_TEMPO_REVELACAO
      }
    } else {
      s.respostas.push({ seat, text: texto, acertou: false })
    }
    if (s.respostas.length > MAX_RESPOSTAS) s.respostas.splice(0, s.respostas.length - MAX_RESPOSTAS)
    return { state: s }
  }

  return { error: 'Ação inválida' }
}

export function tickDesenha(s: DesenhaState, dt: number) {
  if (s.fase === 'fim') return
  s.tempo -= dt
  if (s.tempo > 0) return
  if (s.fase === 'escolhendo') {
    // desenhista dormiu no ponto: passa a vez
    proximaRodada(s)
  } else if (s.fase === 'desenhando') {
    s.fase = 'revelacao'
    s.tempo = DESENHA_TEMPO_REVELACAO
  } else if (s.fase === 'revelacao') {
    proximaRodada(s)
  }
}

export function desenhaViewFor(s: DesenhaState, seat: number): DesenhaView {
  const revela = s.fase === 'revelacao' || s.fase === 'fim'
  const souDesenhista = seat === s.desenhista
  // a dica ganha letras conforme o tempo passa (60s e 120s)
  const reveladas = s.fase === 'desenhando' ? (s.tempo < 60 ? 2 : s.tempo < 120 ? 1 : 0) : 0
  return {
    fase: s.fase,
    rodada: s.rodada,
    totalRodadas: s.totalRodadas,
    desenhistaSeat: s.desenhista,
    tempo: Math.max(Math.ceil(s.tempo), 0),
    dica: s.fase === 'desenhando' && s.palavra && !souDesenhista ? dicaDe(s.palavra, reveladas) : null,
    palavra: (souDesenhista || revela) && s.palavra ? s.palavra : null,
    strokes: s.strokes,
    scores: s.scores,
    acertaram: s.acertaram,
    respostas: s.respostas,
    vencedores: s.vencedores,
  }
}

export const desenhaModule: GameModule<DesenhaState, DesenhaAction> = {
  slug: 'desenha-adivinha',
  minPlayers: 3,
  maxPlayers: 6,
  allowSpectators: true,
  realtime: { tickMs: 100, broadcastEvery: 2 },

  init(playerCount) {
    return initialDesenhaState(playerCount)
  },

  play(state, seat, action) {
    return aplicaDesenhaAction(state, seat, action)
  },

  tick(state, dt) {
    tickDesenha(state, dt)
  },

  getStateFor(state, seat) {
    return desenhaViewFor(state, seat)
  },

  scoresFor(state) {
    return state.scores
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.vencedores,
      draw: false,
    }
  },
}
