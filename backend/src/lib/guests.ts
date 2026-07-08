import type { PrismaClient } from '@prisma/client'

/**
 * Convidados ("jogar sem conta") são TEMPORÁRIOS: somem ao sair, fechar o
 * navegador ou por um coletor de segurança. Cada visita fica registrada
 * em GuestVisit (permanente) para o relatório mensal.
 */

/** apaga o usuário-convidado; antes remove as salas que ele criou (FK do host) */
export async function deleteGuest(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.isGuest) return
  await prisma.room.deleteMany({ where: { hostId: userId } })
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
}

/** rede de segurança: remove convidados esquecidos (sessão antiga) */
export async function reapOldGuests(prisma: PrismaClient, olderThanHours = 12): Promise<number> {
  const limite = new Date(Date.now() - olderThanHours * 3600_000)
  const velhos = await prisma.user.findMany({
    where: { isGuest: true, createdAt: { lt: limite } },
    select: { id: true },
  })
  for (const g of velhos) await deleteGuest(prisma, g.id)
  return velhos.length
}

/** início do mês atual (para a contagem mensal do relatório) */
export function inicioDoMes(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
