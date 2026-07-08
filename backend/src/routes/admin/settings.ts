import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getLoginMaxAttempts, setLoginMaxAttempts, SETTINGS } from '../../lib/settings'
import { audit } from '../../lib/audit'

/** Configurações da plataforma editáveis pelo admin. */
export default async function settingsAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/settings', async () => {
    return { loginMaxAttempts: await getLoginMaxAttempts(app.prisma) }
  })

  const body = z.object({
    loginMaxAttempts: z
      .number()
      .int()
      .min(SETTINGS.loginMaxAttempts.min)
      .max(SETTINGS.loginMaxAttempts.max),
  })

  app.put('/api/admin/settings', async (req) => {
    const input = body.parse(req.body)
    const loginMaxAttempts = await setLoginMaxAttempts(app.prisma, input.loginMaxAttempts)
    await audit(app.prisma, 'admin.settings.update', {
      userId: req.auth!.sub,
      req,
      detail: { loginMaxAttempts },
    })
    return { loginMaxAttempts }
  })
}
