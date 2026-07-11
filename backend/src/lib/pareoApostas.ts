import type { PrismaClient } from '@prisma/client'
import {
  PAREO_APOSTAS_FICHAS,
  PAREO_CAUDA_MS,
  PAREO_CAVALOS,
  PAREO_CORRIDA_MS,
  PAREO_ODDS,
  pareoBuildRace,
} from '@mesapop/shared'
import type { PareoState } from '../games/pareo'
import {
  liquidarApostasCorrida,
  registrarApostaCorrida,
  type ApostaOk,
  type BetDelegate,
  type CorridaApostasCfg,
} from './corridaApostas'

/**
 * Apostas do Páreo — instância do motor genérico de corridas
 * (corridaApostas.ts) plugado na tabela PareoBet e na simulação dos
 * cavalos. Regras e garantias (débito atômico, unicidade, liquidação
 * determinística e idempotente) vêm do motor.
 */

/** erros no vocabulário histórico do Páreo (a rota traduz p/ mensagens) */
export type ApostaErro =
  | 'FASE_ERRADA'
  | 'PAREO_TROCOU'
  | 'VALOR_INVALIDO'
  | 'CAVALO_INVALIDO'
  | 'JA_APOSTOU'
  | 'SEM_FICHAS'
export type { ApostaOk }

const CFG: CorridaApostasCfg = {
  delegate: (prisma) => prisma.pareoBet as unknown as BetDelegate,
  stakes: PAREO_APOSTAS_FICHAS,
  odds: PAREO_ODDS,
  nLanes: PAREO_CAVALOS.length,
  corridaMs: PAREO_CORRIDA_MS,
  caudaMs: PAREO_CAUDA_MS,
  vencedorDe: (seed) => pareoBuildRace(seed).vencedor,
}

const TRADUZ: Record<string, ApostaErro> = {
  CORRIDA_TROCOU: 'PAREO_TROCOU',
  RAIA_INVALIDA: 'CAVALO_INVALIDO',
}

export async function registrarAposta(
  prisma: PrismaClient,
  opts: { userId: string; roomId: string; state: PareoState; numero: number; lane: number; valor: number },
): Promise<{ erro: ApostaErro } | ApostaOk> {
  const res = await registrarApostaCorrida(prisma, CFG, opts)
  if ('erro' in res) return { erro: TRADUZ[res.erro] ?? (res.erro as ApostaErro) }
  return res
}

export async function liquidarApostas(prisma: PrismaClient, agora = new Date()) {
  return liquidarApostasCorrida(prisma, CFG, agora)
}
