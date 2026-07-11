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

/**
 * Apostas do Páreo — 100% servidor: o débito é ATÔMICO na carteira de
 * fichas da plataforma, uma aposta por corrida por jogador, e a
 * liquidação é DETERMINÍSTICA (a seed gravada na aposta reconstrói o
 * vencedor) e IDEMPOTENTE (só linhas 'pendente' pagam, uma única vez) —
 * mesmo se a sala morrer no meio, nenhuma ficha fica presa.
 */

export type ApostaErro =
  | 'FASE_ERRADA'
  | 'PAREO_TROCOU'
  | 'VALOR_INVALIDO'
  | 'CAVALO_INVALIDO'
  | 'JA_APOSTOU'
  | 'SEM_FICHAS'

export interface ApostaOk {
  betId: string
  lane: number
  valor: number
  odds: number
  fichas: number
}

export async function registrarAposta(
  prisma: PrismaClient,
  opts: { userId: string; roomId: string; state: PareoState; numero: number; lane: number; valor: number },
): Promise<{ erro: ApostaErro } | ApostaOk> {
  const { userId, roomId, state, numero, lane, valor } = opts
  // fechamento: só durante a fase de apostas E do páreo que o cliente viu
  if (state.fase !== 'apostas') return { erro: 'FASE_ERRADA' }
  if (numero !== state.numero) return { erro: 'PAREO_TROCOU' }
  if (!Number.isInteger(lane) || lane < 0 || lane >= PAREO_CAVALOS.length) return { erro: 'CAVALO_INVALIDO' }
  if (!PAREO_APOSTAS_FICHAS.includes(valor)) return { erro: 'VALOR_INVALIDO' }

  const jaTem = await prisma.pareoBet.findUnique({
    where: { roomId_numero_userId: { roomId, numero, userId } },
  })
  if (jaTem) return { erro: 'JA_APOSTOU' }

  // débito ATÔMICO: só passa se houver saldo (sem corrida entre requisições)
  const debitado = await prisma.user.updateMany({
    where: { id: userId, isGuest: false, fichas: { gte: valor } },
    data: { fichas: { decrement: valor } },
  })
  if (debitado.count === 0) return { erro: 'SEM_FICHAS' }

  const odds = PAREO_ODDS[lane]!
  // quando a corrida com certeza terminou (largada + corrida + folga)
  const liquidaEm = new Date(state.largadaEm + PAREO_CORRIDA_MS + PAREO_CAUDA_MS)
  try {
    const bet = await prisma.pareoBet.create({
      data: { userId, roomId, numero, seed: state.seed, lane, valor, odds, liquidaEm },
    })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fichas: true } })
    return { betId: bet.id, lane, valor, odds, fichas: user?.fichas ?? 0 }
  } catch {
    // corrida rara: duas requisições passaram no findUnique — a PK única
    // barrou a segunda; devolve as fichas debitadas
    await prisma.user.update({ where: { id: userId }, data: { fichas: { increment: valor } } })
    return { erro: 'JA_APOSTOU' }
  }
}

/**
 * Liquida as apostas vencidas (corrida já terminada): calcula o vencedor
 * pela SEED e credita valor × odds nos acertadores. Pagamento idempotente:
 * a linha só sai de 'pendente' uma vez (updateMany condicional).
 */
export async function liquidarApostas(
  prisma: PrismaClient,
  agora = new Date(),
): Promise<{ liquidadas: number; pagas: number }> {
  const vencidas = await prisma.pareoBet.findMany({
    where: { resultado: 'pendente', liquidaEm: { lte: agora } },
    take: 500,
  })
  let pagas = 0
  const vencedorPorSeed = new Map<number, number>()
  for (const bet of vencidas) {
    let vencedor = vencedorPorSeed.get(bet.seed)
    if (vencedor === undefined) {
      vencedor = pareoBuildRace(bet.seed).vencedor
      vencedorPorSeed.set(bet.seed, vencedor)
    }
    const ganhou = bet.lane === vencedor
    const payout = ganhou ? Math.round(bet.valor * bet.odds) : 0
    // sai de 'pendente' UMA única vez — se outra instância liquidou antes,
    // count=0 e nada é pago de novo
    const marcada = await prisma.pareoBet.updateMany({
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
