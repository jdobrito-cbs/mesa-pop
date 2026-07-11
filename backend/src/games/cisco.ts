/**
 * Cisco (Fazenda do Bruno) — corrida de galinhas com apostas. Usa a
 * MESMA infraestrutura de ciclo do Páreo (corridaCiclo.ts); aqui entra
 * só a simulação das galinhas (correr/ciscar + ovos). O servidor é dono
 * do ciclo, da seed e do resultado; a seed só trafega na largada.
 */
import {
  CISCO_APOSTAS_MS,
  CISCO_CAUDA_MS,
  CISCO_CERIMONIA_MS,
  CISCO_CORRIDA_MS,
  CISCO_GALINHAS,
  CISCO_PRELARGADA_MS,
  ciscoBuildRace,
} from '@mesapop/shared'
import type { GameModule } from './module'
import {
  avancaCicloCorrida,
  novaCorrida,
  viewDeCorrida,
  type CorridaConfig,
  type CorridaState,
} from './corridaCiclo'

export type CiscoState = CorridaState

function config(): CorridaConfig {
  return {
    // envs de teste/demo (padrão do projeto): encurtam as fases de espera
    apostasMs: Number(process.env.CISCO_APOSTAS_MS ?? CISCO_APOSTAS_MS),
    prelargadaMs: Number(process.env.CISCO_PRELARGADA_MS ?? CISCO_PRELARGADA_MS),
    corridaMs: CISCO_CORRIDA_MS,
    cerimoniaMs: CISCO_CERIMONIA_MS,
    caudaMs: CISCO_CAUDA_MS,
    resultadoDe(seed) {
      const r = ciscoBuildRace(seed)
      return { vencedor: r.vencedor, winCrossT: r.winCrossT }
    },
    nomeDe: (lane) => CISCO_GALINHAS[lane]!.nome,
  }
}

/** prepara uma nova corrida a partir de `agora` (fase de apostas) */
export function novoCisco(numero: number, historico: string[], agora = Date.now()): CiscoState {
  return novaCorrida(config(), numero, historico, agora)
}

/** avança o ciclo pelas horas OFICIAIS do servidor (tick realtime) */
export function avancaCicloCisco(s: CiscoState, agora = Date.now()): void {
  avancaCicloCorrida(config(), s, agora)
}

export const ciscoModule: GameModule<CiscoState, unknown> = {
  slug: 'cisco',
  minPlayers: 1,
  maxPlayers: 16,
  allowSpectators: true,
  // público contínuo: entra jogando, sem espera; sala cheia → outra sala
  dropIn: true,
  realtime: { tickMs: 500, broadcastEvery: 4 },

  init() {
    return novoCisco(1, [])
  },

  tick(state) {
    avancaCicloCisco(state)
  },

  play() {
    return { error: 'Aposte pelo painel de apostas (fora do turno de ações)' }
  },

  getStateFor(state) {
    return viewDeCorrida(state)
  },

  // jogo CONTÍNUO por sala (igual ao Páreo)
  result() {
    return { finished: false, winnerSeats: [], draw: false }
  },
}
