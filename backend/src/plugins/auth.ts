import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessTokenPayload | null
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(async (app) => {
  app.decorateRequest('auth', null)

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Token ausente' })
    }
    try {
      req.auth = verifyAccessToken(header.slice('Bearer '.length))
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Token inválido ou expirado' })
    }
  })

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply)
    if (reply.sent) return
    if (req.auth?.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Acesso restrito a administradores' })
    }
  })
})
