import type { PrismaClient } from '@prisma/client'
import type { CorridaState } from '../games/corridaCiclo'

/**
 * Apostas GENÉRICAS de corrida (Páreo/cavalos e Cisco/galinhas usam o
 * MESMO motor): débito ATÔMICO na carteira de fichas da plataforma, uma
 * aposta por corrida por jogador, e liquidação DETERMINÍSTICA (a seed
 * gravada na aposta reconstrói o vencedor) e IDEMPOTENTE (linha só sai
 * de 'pendente' uma vez) — mesmo se a sala morrer, nenhuma ficha fica
 * presa nem é paga em dobro. Cada jogo pluga sua tabela e simulação.
 */

export type ApostaErro =
  | 'FASE_ERRADA'
  | 'CORRIDA_TROCOU'
  | 'VALOR_INVALIDO'
  | 'RAIA_INVALIDA'
  | 'JA_APOSTOU'
  | 'SEM_FICHAS'

export interface ApostaOk {
  betId: string
  lane: number
  valor: number
  odds: number
  fichas: number
}

export interface BetRow {
  id: string
  userId: string
  roomId: string
  numero: number
  seed: number
  lane: number
  valor: number
  odds: number
  resultado: string
  payout: number
  liquidaEm: Date
  createdAt: Date
}

/** o subconjunto do delegate Prisma que o motor usa (PareoBet e CiscoBet
 *  têm o MESMO formato, então ambos casam estruturalmente) */
export interface BetDelegate {
  findUnique(args: {
    where: { roomId_numero_userId: { roomId: string; numero: number; userId: string } }
  }): Promise<BetRow | null>
  findFirst(args: {
    where: Record<string, unknown>
    orderBy?: Record<string, unknown>
  }): Promise<BetRow | null>
  findMany(args: { where: Record<string, unknown>; take?: number }): Promise<BetRow[]>
  create(args: { data: Record<string, unknown> }): Promise<BetRow>
  updateMany(args: {
    where: Record<string, unknown>
    data: Record<string, unknown>
  }): Promise<{ count: number }>
}

export interface CorridaApostasCfg {
  /** tabela de apostas do jogo (ex.: prisma.pareoBet) */
  delegate(prisma: PrismaClient): BetDelegate
  /** valores de ficha aceitos */
  stakes: number[]
  /** odds fixas por raia */
  odds: number[]
  nLanes: number
  corridaMs: number
  caudaMs: number
  /** vencedor determinístico a partir da seed */
  vencedorDe(seed: number): number
}

export async function registrarApostaCorrida(
  prisma: PrismaClient,
  cfg: CorridaApostasCfg,
  opts: { userId: string; roomId: string; state: CorridaState; numero: number; lane: number; valor: number },
): Promise<{ erro: ApostaErro } | ApostaOk> {
  const { userId, roomId, state, numero, lane, valor } = opts
  const bets = cfg.delegate(prisma)
  // fechamento: só durante a fase de apostas E da corrida que o cliente viu
  if (state.fase !== 'apostas') return { erro: 'FASE_ERRADA' }
  if (numero !== state.numero) return { erro: 'CORRIDA_TROCOU' }
  if (!Number.isInteger(lane) || lane < 0 || lane >= cfg.nLanes) return { erro: 'RAIA_INVALIDA' }
  if (!cfg.stakes.includes(valor)) return { erro: 'VALOR_INVALIDO' }

  const jaTem = await bets.findUnique({ where: { roomId_numero_userId: { roomId, numero, userId } } })
  if (jaTem) return { erro: 'JA_APOSTOU' }

  // débito ATÔMICO: só passa se houver saldo (sem corrida entre requisições)
  const debitado = await prisma.user.updateMany({
    where: { id: userId, isGuest: false, fichas: { gte: valor } },
    data: { fichas: { decrement: valor } },
  })
  if (debitado.count === 0) return { erro: 'SEM_FICHAS' }

  const odds = cfg.odds[lane]!
  // quando a corrida com certeza terminou (largada + corrida + folga)
  const liquidaEm = new Date(state.largadaEm + cfg.corridaMs + cfg.caudaMs)
  try {
    const bet = await bets.create({
      data: { userId, roomId, numero, seed: state.seed, lane, valor, odds, liquidaEm },
    })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fichas: true } })
    return { betId: bet.id, lane, valor, odds, fichas: user?.fichas ?? 0 }
  } catch {
    // corrida rara: duas requisições passaram no findUnique — a chave única
    // barrou a segunda; devolve as fichas debitadas
    await prisma.user.update({ where: { id: userId }, data: { fichas: { increment: valor } } })
    return { erro: 'JA_APOSTOU' }
  }
}

/**
 * Liquida as apostas vencidas: recalcula o vencedor pela SEED e credita
 * valor × odds nos acertadores. Pagamento idempotente (updateMany
 * condicional em 'pendente').
 */
export async function liquidarApostasCorrida(
  prisma: PrismaClient,
  cfg: CorridaApostasCfg,
  agora = new Date(),
): Promise<{ liquidadas: number; pagas: number }> {
  const bets = cfg.delegate(prisma)
  const vencidas = await bets.findMany({
    where: { resultado: 'pendente', liquidaEm: { lte: agora } },
    take: 500,
  })
  let pagas = 0
  const vencedorPorSeed = new Map<number, number>()
  for (const bet of vencidas) {
    let vencedor = vencedorPorSeed.get(bet.seed)
    if (vencedor === undefined) {
      vencedor = cfg.vencedorDe(bet.seed)
      vencedorPorSeed.set(bet.seed, vencedor)
    }
    const ganhou = bet.lane === vencedor
    const payout = ganhou ? Math.round(bet.valor * bet.odds) : 0
    const marcada = await bets.updateMany({
      where: { id: bet.id, resultado: 'pendente' },
      data: { resultado: ganhou ? 'ganhou' : 'perdeu', payout },
    })
    if (marcada.count === 0) continue
    if (payout > 0) {
      await prisma.user.update({ where: { id: bet.userId }, data: { fichas: { increment: payout } } })
      pagas++
    }
  }
  return { liquidadas: vencidas.length, pagas }
}
