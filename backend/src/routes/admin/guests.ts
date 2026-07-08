import type { FastifyInstance } from 'fastify'
import type { GuestsOverview, GuestView } from '@mesapop/shared'
import { audit } from '../../lib/audit'
import { deleteGuest, inicioDoMes } from '../../lib/guests'

/**
 * Convidados ("jogar sem conta"): área exclusiva. São TEMPORÁRIOS (somem ao
 * sair/fechar o navegador) — mas cada visita fica contabilizada em GuestVisit
 * para o relatório mensal de quantos jogaram na plataforma.
 */
export default async function guestsAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/guests', async (): Promise<GuestsOverview> => {
    const [ativos, mesAtual] = await Promise.all([
      app.prisma.user.findMany({
        where: { isGuest: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, displayName: true, createdAt: true },
      }),
      app.prisma.guestVisit.count({ where: { createdAt: { gte: inicioDoMes() } } }),
    ])
    const items: GuestView[] = ativos.map((g) => ({
      id: g.id,
      name: g.displayName,
      createdAt: g.createdAt.toISOString(),
    }))
    return { items, online: items.length, monthCount: mesAtual }
  })

  // remove manualmente um convidado (libera o nome imediatamente)
  app.delete('/api/admin/guests/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const g = await app.prisma.user.findUnique({ where: { id } })
    if (!g || !g.isGuest) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Convidado não encontrado' })
    }
    await deleteGuest(app.prisma, id)
    await audit(app.prisma, 'admin.guest.remove', {
      userId: req.auth!.sub,
      req,
      detail: { name: g.displayName },
    })
    return { ok: true }
  })
}
