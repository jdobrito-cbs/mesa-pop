import type { FastifyInstance } from 'fastify'
import { AVATARES_ESPECIAIS } from '@mesapop/shared'
import { audit } from '../lib/audit'

const CUSTO_TROCA = 1000

/** Troca de fichas por avatar ESPECIAL sorteado (máquina gumball). */
export default async function fichasRoutes(app: FastifyInstance) {
  app.post('/api/fichas/trocar', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.auth!.guest) {
      return reply.code(403).send({ error: 'LOGIN_REQUIRED', message: 'Crie sua conta para juntar e trocar fichas' })
    }
    const userId = req.auth!.sub
    // débito atômico: só passa se tiver saldo (sem corrida entre requisições)
    const debitado = await app.prisma.user.updateMany({
      where: { id: userId, fichas: { gte: CUSTO_TROCA } },
      data: { fichas: { decrement: CUSTO_TROCA } },
    })
    if (debitado.count === 0) {
      return reply.code(400).send({ error: 'SEM_FICHAS', message: `Você precisa de ${CUSTO_TROCA} fichas para girar a máquina` })
    }
    const owned = await app.prisma.avatarOwned.findMany({ where: { userId }, select: { avatarId: true } })
    const tem = new Set(owned.map((o) => o.avatarId))
    const disponiveis = AVATARES_ESPECIAIS.filter((id) => !tem.has(id))
    if (disponiveis.length === 0) {
      // coleção completa: devolve as fichas
      await app.prisma.user.update({ where: { id: userId }, data: { fichas: { increment: CUSTO_TROCA } } })
      return reply.code(409).send({ error: 'COLECAO_COMPLETA', message: 'Você já tem TODOS os avatares especiais! 🏆' })
    }
    const avatar = disponiveis[Math.floor(Math.random() * disponiveis.length)]!
    await app.prisma.avatarOwned.create({ data: { userId, avatarId: avatar } })
    await audit(app.prisma, 'fichas.trocar', { userId, req, detail: { avatar, custo: CUSTO_TROCA } })
    const user = await app.prisma.user.findUnique({ where: { id: userId } })
    return { avatar, fichas: user?.fichas ?? 0 }
  })
}
