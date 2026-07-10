import type { PrismaClient } from '@prisma/client'
import type { RankingGeralRow } from '@mesapop/shared'

/**
 * Rankings gerais (pontos somados e tempo jogado) com cache de 60s —
 * alimentam a página /rankings, os banners da Mesa e o DESBLOQUEIO de
 * avatares (top 10 = especiais; nº 1 = super).
 */
const TTL_MS = 60_000
const TOP_N = 10

interface Calculado {
  pontosPorUser: Map<string, number>
  tempoPorUser: Map<string, number>
  pontosOrdenado: string[] // userIds na ordem do ranking
  tempoOrdenado: string[]
  pontosTop: RankingGeralRow[]
  tempoTop: RankingGeralRow[]
}
let cache: { at: number; data: Calculado } | null = null

export function limparCacheRankings(): void {
  cache = null
}

async function calcula(prisma: PrismaClient): Promise<Calculado> {
  // pontos: soma dos scores de MatchPlayer (contas registradas)
  const somas = await prisma.matchPlayer.groupBy({
    by: ['userId'],
    where: { user: { isGuest: false } },
    _sum: { score: true },
  })
  const pontosPorUser = new Map(somas.map((r) => [r.userId, r._sum.score ?? 0]))

  // tempo: duração das partidas FINALIZADAS que cada um jogou
  const matches = await prisma.match.findMany({
    where: { status: 'FINISHED', endedAt: { not: null } },
    select: { startedAt: true, endedAt: true, players: { select: { userId: true, user: { select: { isGuest: true } } } } },
  })
  const tempoPorUser = new Map<string, number>()
  for (const m of matches) {
    const dur = m.endedAt!.getTime() - m.startedAt.getTime()
    if (dur <= 0) continue
    for (const p of m.players) {
      if (p.user.isGuest) continue
      tempoPorUser.set(p.userId, (tempoPorUser.get(p.userId) ?? 0) + dur)
    }
  }

  const ordena = (mapa: Map<string, number>) =>
    [...mapa.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const pontosOrdenado = ordena(pontosPorUser)
  const tempoOrdenado = ordena(tempoPorUser)

  // dados de exibição do top N dos dois rankings
  const ids = [...new Set([...pontosOrdenado.slice(0, TOP_N), ...tempoOrdenado.slice(0, TOP_N)])]
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, avatar: true } })
  const info = new Map(users.map((u) => [u.id, u]))
  const linhas = (ordenado: string[], mapa: Map<string, number>): RankingGeralRow[] =>
    ordenado.slice(0, TOP_N).map((id, i) => ({
      rank: i + 1,
      userId: id,
      displayName: info.get(id)?.displayName ?? '?',
      avatar: info.get(id)?.avatar ?? null,
      valor: mapa.get(id) ?? 0,
    }))
  return { pontosPorUser, tempoPorUser, pontosOrdenado, tempoOrdenado, pontosTop: linhas(pontosOrdenado, pontosPorUser), tempoTop: linhas(tempoOrdenado, tempoPorUser) }
}

async function dados(prisma: PrismaClient): Promise<Calculado> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  const data = await calcula(prisma)
  cache = { at: Date.now(), data }
  return data
}

export async function rankingsGeraisTop(prisma: PrismaClient): Promise<{ pontos: RankingGeralRow[]; tempo: RankingGeralRow[] }> {
  const d = await dados(prisma)
  return { pontos: d.pontosTop, tempo: d.tempoTop }
}

/** posição do usuário em cada ranking (1-based; null = sem partidas) */
export async function posicoesDe(prisma: PrismaClient, userId: string): Promise<{ pontos: number | null; tempo: number | null }> {
  const d = await dados(prisma)
  const ip = d.pontosOrdenado.indexOf(userId)
  const it = d.tempoOrdenado.indexOf(userId)
  return { pontos: ip >= 0 ? ip + 1 : null, tempo: it >= 0 ? it + 1 : null }
}

/** melhor posição entre os dois rankings (para o desbloqueio de avatares) */
export async function melhorPosicao(prisma: PrismaClient, userId: string): Promise<number | null> {
  const p = await posicoesDe(prisma, userId)
  const xs = [p.pontos, p.tempo].filter((x): x is number => x !== null)
  return xs.length ? Math.min(...xs) : null
}
