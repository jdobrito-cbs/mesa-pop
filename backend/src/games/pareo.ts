/**
 * Páreo (O "Corre" do Yvens) — o SERVIDOR é dono do ciclo da sala
 * (apostas → pré-largada → corrida → cerimônia), da seed e do
 * resultado. A infraestrutura do ciclo é COMPARTILHADA com o Cisco
 * (corridaCiclo.ts); aqui entra só a simulação dos cavalos. A seed só
 * trafega a partir da largada (as apostas já fecharam e o resultado é
 * imutável). Clientes reproduzem a corrida deterministicamente a
 * partir da seed + timestamps do servidor.
 */
import {
  PAREO_APOSTAS_MS,
  PAREO_CAUDA_MS,
  PAREO_CAVALOS,
  PAREO_CERIMONIA_MS,
  PAREO_CORRIDA_MS,
  PAREO_PRELARGADA_MS,
  pareoBuildRace,
} from '@mesapop/shared'
import type { GameModule } from './module'
import {
  avancaCicloCorrida,
  novaCorrida,
  viewDeCorrida,
  type CorridaConfig,
  type CorridaState,
} from './corridaCiclo'

export type PareoState = CorridaState

function config(): CorridaConfig {
  return {
    // envs de teste/demo (padrão do projeto): encurtam as fases de espera
    apostasMs: Number(process.env.PAREO_APOSTAS_MS ?? PAREO_APOSTAS_MS),
    prelargadaMs: Number(process.env.PAREO_PRELARGADA_MS ?? PAREO_PRELARGADA_MS),
    corridaMs: PAREO_CORRIDA_MS,
    cerimoniaMs: PAREO_CERIMONIA_MS,
    caudaMs: PAREO_CAUDA_MS,
    resultadoDe(seed) {
      const r = pareoBuildRace(seed)
      return { vencedor: r.vencedor, winCrossT: r.winCrossT }
    },
    nomeDe: (lane) => PAREO_CAVALOS[lane]!.nome,
  }
}

/** prepara um novo páreo a partir de `agora` (fase de apostas) */
export function novoPareo(numero: number, historico: string[], agora = Date.now()): PareoState {
  return novaCorrida(config(), numero, historico, agora)
}

/** avança o ciclo pelas horas OFICIAIS do servidor (tick realtime) */
export function avancaCiclo(s: PareoState, agora = Date.now()): void {
  avancaCicloCorrida(config(), s, agora)
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
    return { error: 'Aposte pelo painel de apostas (fora do turno de ações)' }
  },

  getStateFor(state) {
    return viewDeCorrida(state)
  },

  // jogo CONTÍNUO: a partida não "termina" — a sala roda páreos enquanto
  // houver gente; sala esvaziou → o manager encerra normalmente
  result() {
    return { finished: false, winnerSeats: [], draw: false }
  },
}
