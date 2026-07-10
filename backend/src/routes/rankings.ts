import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { RankingsGerais } from '@mesapop/shared'
import { verifyAccessToken } from '../lib/tokens'
import { posicoesDe, rankingsGeraisTop } from '../lib/rankingsGerais'

/** identifica o usuário se houver token — sem exigir (ranking é público) */
function optionalUserId(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const payload = verifyAccessToken(header.slice(7))
    return payload.guest ? null : payload.sub
  } catch {
    return null
  }
}

/** Rankings gerais da plataforma: pontos somados e tempo jogado (top 10). */
export default async function rankingsRoutes(app: FastifyInstance) {
  app.get('/api/rankings/gerais', async (req): Promise<RankingsGerais> => {
    const top = await rankingsGeraisTop(app.prisma)
    const userId = optionalUserId(req)
    const voce = userId ? await posicoesDe(app.prisma, userId) : null
    return { ...top, voce }
  })
}
