import type { FastifyInstance } from 'fastify'
import { setupSchema } from '@mesapop/shared'
import { hashPassword } from '../lib/password'
import { audit } from '../lib/audit'

/**
 * Configuração inicial (primeiro acesso): enquanto NÃO existir nenhum
 * admin, o app abre a tela /setup para criar a conta de administrador.
 * Assim que houver um admin, estas rotas se fecham — o primeiro a
 * configurar vira o dono. Não emite sessão: ao criar, manda para o login.
 */
export default async function setupRoutes(app: FastifyInstance) {
  const temAdmin = () => app.prisma.user.count({ where: { role: 'ADMIN' } })

  app.get('/api/setup/status', async () => {
    return { needsSetup: (await temAdmin()) === 0 }
  })

  app.post(
    '/api/setup/admin',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if ((await temAdmin()) > 0) {
        return reply
          .code(403)
          .send({ error: 'SETUP_DONE', message: 'A configuração inicial já foi concluída' })
      }
      const input = setupSchema.parse(req.body)

      const emailTaken = await app.prisma.user.findUnique({ where: { email: input.email } })
      if (emailTaken) {
        return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado' })
      }
      const usernameTaken = await app.prisma.user.findUnique({ where: { username: input.username } })
      if (usernameTaken) {
        return reply.code(409).send({ error: 'USERNAME_TAKEN', message: 'Este nome de usuário já existe' })
      }

      const user = await app.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          name: input.name,
          displayName: input.username,
          phone: '',
          passwordHash: await hashPassword(input.password),
          role: 'ADMIN',
        },
      })
      await audit(app.prisma, 'setup.admin_created', { userId: user.id, req })
      return reply.code(201).send({ ok: true })
    },
  )
}
