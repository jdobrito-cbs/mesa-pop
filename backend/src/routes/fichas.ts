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

    // sorteia ANTES de debitar (coleção completa nem toca no saldo)
    const owned = await app.prisma.avatarOwned.findMany({ where: { userId }, select: { avatarId: true } })
    const tem = new Set(owned.map((o) => o.avatarId))
    const disponiveis = AVATARES_ESPECIAIS.filter((id) => !tem.has(id))
    if (disponiveis.length === 0) {
      return reply.code(409).send({ error: 'COLECAO_COMPLETA', message: 'Você já tem TODOS os avatares especiais! 🏆' })
    }
    const avatar = disponiveis[Math.floor(Math.random() * disponiveis.length)]!

    // débito + posse na MESMA transação: qualquer falha (inclusive duas
    // requisições sorteando o mesmo avatar → PK violada) desfaz o débito —
    // nenhuma ficha se perde no caminho.
    let debitou = false
    try {
      debitou = await app.prisma.$transaction(async (tx) => {
        const deb = await tx.user.updateMany({
          where: { id: userId, fichas: { gte: CUSTO_TROCA } },
          data: { fichas: { decrement: CUSTO_TROCA } },
        })
        if (deb.count === 0) return false
        await tx.avatarOwned.create({ data: { userId, avatarId: avatar } })
        return true
      })
    } catch {
      return reply.code(503).send({ error: 'MAQUINA_OCUPADA', message: 'A máquina engasgou — tente de novo' })
    }
    if (!debitou) {
      return reply.code(400).send({ error: 'SEM_FICHAS', message: `Você precisa de ${CUSTO_TROCA} fichas para girar a máquina` })
    }

    await audit(app.prisma, 'fichas.trocar', { userId, req, detail: { avatar, custo: CUSTO_TROCA } })
    const user = await app.prisma.user.findUnique({ where: { id: userId } })
    return { avatar, fichas: user?.fichas ?? 0 }
  })
}
