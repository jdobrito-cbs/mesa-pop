import crypto from 'node:crypto'
import {
  GG_CATEGORIAS,
  GG_META,
  type GGAction,
  type GGCategoria,
  type GGFase,
  type GGUltimo,
  type GGView,
} from '@mesapop/shared'
import { GIRA_GENIO_BANCO } from '../lib/giraGenioPerguntas'
import type { GameModule } from './module'

interface PerguntaAtiva {
  texto: string
  opcoes: string[]
  /** índice da alternativa correta nas opções embaralhadas (NUNCA vai ao cliente) */
  correta: number
}

export interface GGState {
  players: number
  fase: GGFase
  turn: number
  coroas: GGCategoria[][]
  categoria: GGCategoria | null
  pergunta: PerguntaAtiva | null
  /** textos de perguntas recém-usadas (evita repetição imediata) */
  recentes: string[]
  ultimo: GGUltimo | null
  winnerSeats: number[]
}

function embaralha<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** monta uma pergunta ativa: sorteia da categoria, embaralha e rastreia a correta */
function sorteiaPergunta(cat: GGCategoria, recentes: string[]): PerguntaAtiva {
  const pool = GIRA_GENIO_BANCO[cat]
  const frescas = pool.filter((p) => !recentes.includes(p.pergunta))
  const escolha = (frescas.length ? frescas : pool)[crypto.randomInt((frescas.length ? frescas : pool).length)]!
  const correta = escolha.alternativas[0]!
  const opcoes = embaralha(escolha.alternativas)
  return { texto: escolha.pergunta, opcoes, correta: opcoes.indexOf(correta) }
}

export function initialGiraGenioState(players: number): GGState {
  return {
    players,
    fase: 'escolhendo',
    turn: 0,
    coroas: Array.from({ length: players }, () => []),
    categoria: null,
    pergunta: null,
    recentes: [],
    ultimo: null,
    winnerSeats: [],
  }
}

export const giraGenioModule: GameModule<GGState, GGAction> = {
  slug: 'gira-genio',
  minPlayers: 2,
  maxPlayers: 6,
  // o robô "pensa" o bastante para a roleta girar (3s) + o salto da categoria
  botDelayMs: 4500,

  init(playerCount) {
    return initialGiraGenioState(playerCount)
  },

  play(state, seat, action) {
    if (state.fase === 'fim') return { error: 'A partida já terminou' }
    if (state.turn !== seat) return { error: 'Não é a sua vez' }

    if (action?.type === 'girar') {
      if (state.fase !== 'escolhendo') return { error: 'Você já girou — responda a pergunta' }
      const categoria = GG_CATEGORIAS[crypto.randomInt(GG_CATEGORIAS.length)]!.id
      const pergunta = sorteiaPergunta(categoria, state.recentes)
      const recentes = [pergunta.texto, ...state.recentes].slice(0, 8)
      return { state: { ...state, fase: 'pergunta', categoria, pergunta, recentes, ultimo: null } }
    }

    if (action?.type === 'responder') {
      if (state.fase !== 'pergunta' || !state.pergunta || state.categoria === null) {
        return { error: 'Gire a roleta primeiro' }
      }
      if (typeof action.opcao !== 'number') return { error: 'Resposta inválida' }
      const cat = state.categoria
      const acertou = action.opcao === state.pergunta.correta
      const jaTinha = state.coroas[seat]!.includes(cat)
      const ganhouCoroa = acertou && !jaTinha
      const coroas = state.coroas.map((c, i) => (i === seat && ganhouCoroa ? [...c, cat] : c))
      const venceu = coroas[seat]!.length >= GG_META
      const ultimo: GGUltimo = {
        seat,
        categoria: cat,
        acertou,
        ganhouCoroa,
        respostaCerta: state.pergunta.opcoes[state.pergunta.correta]!,
      }
      return {
        state: {
          ...state,
          coroas,
          fase: venceu ? 'fim' : 'escolhendo',
          // acertou → mesmo jogador joga de novo; errou → passa a vez
          turn: venceu ? state.turn : acertou ? state.turn : (state.turn + 1) % state.players,
          categoria: null,
          pergunta: null,
          ultimo,
          winnerSeats: venceu ? [seat] : [],
        },
      }
    }

    return { error: 'Ação inválida' }
  },

  // a resposta correta da pergunta ativa NUNCA trafega
  getStateFor(state): GGView {
    return {
      fase: state.fase,
      turn: state.turn,
      players: state.players,
      coroas: state.coroas,
      categoria: state.categoria,
      pergunta: state.pergunta ? { texto: state.pergunta.texto, opcoes: state.pergunta.opcoes } : null,
      ultimo: state.ultimo,
      winnerSeats: state.winnerSeats,
    }
  },

  currentSeat(state) {
    return state.winnerSeats.length ? null : state.turn
  },

  bot(state, seat) {
    if (state.winnerSeats.length || state.turn !== seat) return null
    if (state.fase === 'escolhendo') return { type: 'girar' }
    if (state.fase === 'pergunta' && state.pergunta) {
      // nível equilibrado: ~72% de acerto; senão erra numa alternativa aleatória
      if (crypto.randomInt(100) < 72) return { type: 'responder', opcao: state.pergunta.correta }
      const erradas = state.pergunta.opcoes.map((_, i) => i).filter((i) => i !== state.pergunta!.correta)
      return { type: 'responder', opcao: erradas[crypto.randomInt(erradas.length)]! }
    }
    return null
  },

  result(state) {
    return {
      finished: state.fase === 'fim',
      winnerSeats: state.winnerSeats,
      draw: false,
    }
  },
}
