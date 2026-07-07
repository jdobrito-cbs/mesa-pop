import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'

/**
 * Serve o site (build do frontend) na MESMA porta da API — deploy de
 * porta única. Só ativa quando o build existe (produção); em dev o Vite
 * cuida do frontend. Rotas /api e /socket.io continuam intactas; qualquer
 * outra rota GET devolve o index.html (SPA com React Router).
 */
export default fp(async (app) => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const dist = path.resolve(here, '../../../frontend/dist')
  const indexHtml = path.join(dist, 'index.html')
  if (!fs.existsSync(indexHtml)) return

  await app.register(fastifyStatic, { root: dist, wildcard: false })

  app.setNotFoundHandler((req, reply) => {
    if (req.method !== 'GET' || req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Rota não encontrada' })
    }
    return reply.type('text/html').send(fs.readFileSync(indexHtml))
  })
})
