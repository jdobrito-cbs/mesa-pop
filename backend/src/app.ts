import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { config } from './config'
import prismaPlugin from './plugins/prisma'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import healthRoutes from './routes/health'
import gamesRoutes from './routes/games'
import soloRoutes from './routes/solo'
import adminRoutes from './routes/admin/index'
import socketPlugin from './realtime/socket'

export interface BuildAppOptions {
  /** Desliga rate limiting (testes de integração). */
  disableRateLimit?: boolean
  logger?: boolean
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
    trustProxy: true,
  })

  await app.register(cors, {
    origin: config.corsOrigin.split(','),
    credentials: true,
  })
  await app.register(cookie)
  if (!opts.disableRateLimit) {
    await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })
  }

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Dados inválidos',
        details: err.flatten().fieldErrors,
      })
    }
    const fastifyErr = err as { statusCode?: number; code?: string; message?: string }
    if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
      return reply.code(fastifyErr.statusCode).send({
        error: fastifyErr.code ?? 'ERROR',
        message: fastifyErr.message ?? 'Erro',
      })
    }
    req.log.error(err)
    return reply.code(500).send({ error: 'INTERNAL', message: 'Erro interno do servidor' })
  })

  await app.register(prismaPlugin)
  await app.register(authPlugin)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(gamesRoutes)
  await app.register(soloRoutes)
  await app.register(adminRoutes)
  await app.register(socketPlugin)

  return app
}
