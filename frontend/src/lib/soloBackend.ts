import { api, ApiRequestError } from './api'

/**
 * Abstrai a pontuação dos jogos solo em dois modos: partida LIVRE
 * (/api/solo/*, seed aleatória, ranking de 30 dias) e DESAFIO DIÁRIO
 * (/api/desafio/*, seed = a data → o mesmo puzzle para todos, uma
 * tentativa por dia, ranking do dia). As páginas de puzzle chamam sempre
 * a mesma interface; só a construção muda pelo modo.
 */

export interface SoloFinish {
  points: number
  rank?: number
  best?: number
  total?: number
}

export interface SoloBackend {
  daily: boolean
  /** seed do gerador: a data (fixa) no diário; nova a cada chamada no livre */
  nextSeed(): string
  /** URL do ranking a exibir */
  leaderboard: string
  /** abre a partida no servidor; devolve um token (matchId/sentinela), '' se não pontua, ou null se JÁ FEZ hoje */
  start(): Promise<string | null>
  /** envia o resultado; null se rejeitado, sem conta ou sem token */
  finish(token: string, points: number): Promise<SoloFinish | null>
}

export function makeSoloBackend(
  slug: string,
  opts: { guest: boolean; daily?: string },
): SoloBackend {
  const { guest, daily } = opts

  if (daily) {
    return {
      daily: true,
      nextSeed: () => daily,
      leaderboard: `/api/desafio/ranking/${slug}`,
      async start() {
        if (guest) return '' // convidado joga, mas não pontua
        try {
          await api('/api/desafio/start', { body: { gameSlug: slug } })
          return 'daily'
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) return null // já jogou hoje
          return ''
        }
      },
      async finish(_token, points) {
        if (guest) return null
        try {
          return await api<SoloFinish>('/api/desafio/finish', { body: { gameSlug: slug, points } })
        } catch {
          return null
        }
      },
    }
  }

  return {
    daily: false,
    nextSeed: () => `${Date.now()}-${Math.random()}`,
    leaderboard: `/api/leaderboards/${slug}`,
    async start() {
      if (guest) return ''
      try {
        const r = await api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: slug } })
        return r.matchId
      } catch {
        return ''
      }
    },
    async finish(token, points) {
      if (!token) return null
      try {
        return await api<SoloFinish>('/api/solo/finish', { body: { matchId: token, points } })
      } catch {
        return null
      }
    },
  }
}
