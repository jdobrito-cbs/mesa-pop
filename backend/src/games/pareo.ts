/**
 * Páreo (O "Corre" do Yvens) — FASE 1: o SERVIDOR é dono do ciclo da
 * sala (apostas → pré-largada → corrida → cerimônia, ~180s), da seed e
 * do resultado. O ciclo só roda enquanto a sala existe (a sala fecha
 * quando o último jogador sai — economia natural de recursos). A seed
 * só trafega a partir da largada: o resultado já está fixado e as
 * apostas (FASE 2) já terão fechado. Clientes reproduzem a corrida
 * deterministicamente a partir da seed + timestamps do servidor.
 */
import crypto from 'node:crypto'
import {
  PAREO_APOSTAS_MS,
  PAREO_CAUDA_MS,
  PAREO_CAVALOS,
  PAREO_CERIMONIA_MS,
  PAREO_CORRIDA_MS,
  PAREO_PRELARGADA_MS,
  pareoBuildRace,
  type PareoFase,
  type PareoView,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface PareoState {
  numero: number
  fase: PareoFase
  faseFimEm: number
  largadaEm: number
  seed: number
  vencedor: number
  /** fração 0..1 em que o vencedor cruza (encurta a fase de corrida) */
  winCrossT: number
  historico: string[]
}

/** duração efetiva da fase de corrida: até o vencedor cruzar + folga */
function corridaMs(winCrossT: number): number {
  return Math.min(PAREO_CORRIDA_MS, Math.round(winCrossT * PAREO_CORRIDA_MS) + PAREO_CAUDA_MS)
}

/** prepara um novo páreo a partir de `agora` (fase de apostas) */
export function novoPareo(numero: number, historico: string[], agora = Date.now()): PareoState {
  const seed = crypto.randomInt(1, 2147483646)
  const corrida = pareoBuildRace(seed)
  // envs de teste/demo (padrão do projeto): encurtam as fases de espera
  const apostasMs = Number(process.env.PAREO_APOSTAS_MS ?? PAREO_APOSTAS_MS)
  const prelargadaMs = Number(process.env.PAREO_PRELARGADA_MS ?? PAREO_PRELARGADA_MS)
  return {
    numero,
    fase: 'apostas',
    faseFimEm: agora + apostasMs,
    largadaEm: agora + apostasMs + prelargadaMs,
    seed,
    vencedor: corrida.vencedor,
    winCrossT: corrida.winCrossT,
    historico,
  }
}

/** avança o ciclo pelas horas OFICIAIS do servidor (tick realtime) */
export function avancaCiclo(s: PareoState, agora = Date.now()): void {
  // laço: se o servidor ficou um tempo sem tick, atravessa as fases devidas
  while (agora >= s.faseFimEm) {
    if (s.fase === 'apostas') {
      s.fase = 'prelargada'
      s.faseFimEm = s.largadaEm
    } else if (s.fase === 'prelargada') {
      s.fase = 'corrida'
      s.faseFimEm = s.largadaEm + corridaMs(s.winCrossT)
    } else if (s.fase === 'corrida') {
      s.fase = 'cerimonia'
      // a cerimônia absorve o resto do ciclo (total constante de ~180s)
      s.faseFimEm = s.largadaEm + PAREO_CORRIDA_MS + PAREO_CERIMONIA_MS
      s.historico = [PAREO_CAVALOS[s.vencedor]!.nome, ...s.historico].slice(0, 8)
    } else {
      // cerimônia terminou → próximo páreo começa AGORA
      const prox = novoPareo(s.numero + 1, s.historico, s.faseFimEm)
      Object.assign(s, prox)
    }
  }
}

function viewDe(s: PareoState): PareoView {
  return {
    numero: s.numero,
    fase: s.fase,
    faseFimEm: s.faseFimEm,
    largadaEm: s.largadaEm,
    agora: Date.now(),
    // a seed (e com ela a corrida inteira) só sai do servidor na largada
    seed: s.fase === 'corrida' || s.fase === 'cerimonia' ? s.seed : null,
    vencedor: s.fase === 'cerimonia' ? s.vencedor : null,
    historico: s.historico,
  }
}

export const pareoModule: GameModule<PareoState, unknown> = {
  slug: 'pareo',
  minPlayers: 1,
  maxPlayers: 16,
  allowSpectators: true,
  // ciclo dirigido pelo relógio do servidor; snapshot a cada ~2s (o cliente
  // anima localmente pela seed + timestamps — não precisa de frames)
  realtime: { tickMs: 500, broadcastEvery: 4 },

  init() {
    return novoPareo(1, [])
  },

  tick(state) {
    avancaCiclo(state)
  },

  play() {
    // FASE 1 é só o ciclo sincronizado — as apostas chegam na FASE 2
    return { error: 'As apostas chegam em breve — por ora, escolha seu favorito e torça!' }
  },

  getStateFor(state) {
    return viewDe(state)
  },

  // jogo CONTÍNUO: a partida não "termina" — a sala roda páreos enquanto
  // houver gente; sala esvaziou → o manager encerra normalmente
  result() {
    return { finished: false, winnerSeats: [], draw: false }
  },
}
