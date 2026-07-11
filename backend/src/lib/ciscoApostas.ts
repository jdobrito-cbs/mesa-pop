import type { PrismaClient } from '@prisma/client'
import {
  CISCO_APOSTAS_FICHAS,
  CISCO_CAUDA_MS,
  CISCO_CORRIDA_MS,
  CISCO_GALINHAS,
  CISCO_ODDS,
  ciscoBuildRace,
} from '@mesapop/shared'
import type { CiscoState } from '../games/cisco'
import {
  liquidarApostasCorrida,
  registrarApostaCorrida,
  type ApostaErro,
  type ApostaOk,
  type BetDelegate,
  type CorridaApostasCfg,
} from './corridaApostas'

/**
 * Apostas do Cisco — instância do motor genérico de corridas plugado na
 * tabela CiscoBet e na simulação das galinhas. As fichas são registradas
 * EXATAMENTE como na corrida de cavalos (pedido do usuário): débito
 * atômico, uma aposta por corrida, liquidação pela seed, idempotente.
 */

export type { ApostaErro, ApostaOk }

const CFG: CorridaApostasCfg = {
  delegate: (prisma) => prisma.ciscoBet as unknown as BetDelegate,
  stakes: CISCO_APOSTAS_FICHAS,
  odds: CISCO_ODDS,
  nLanes: CISCO_GALINHAS.length,
  corridaMs: CISCO_CORRIDA_MS,
  caudaMs: CISCO_CAUDA_MS,
  vencedorDe: (seed) => ciscoBuildRace(seed).vencedor,
}

export async function registrarApostaCisco(
  prisma: PrismaClient,
  opts: { userId: string; roomId: string; state: CiscoState; numero: number; lane: number; valor: number },
): Promise<{ erro: ApostaErro } | ApostaOk> {
  return registrarApostaCorrida(prisma, CFG, opts)
}

export async function liquidarApostasCisco(prisma: PrismaClient, agora = new Date()) {
  return liquidarApostasCorrida(prisma, CFG, agora)
}
