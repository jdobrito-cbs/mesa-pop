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

/**
 * Saída com CARÊNCIA: o pagehide dispara também num simples RELOAD da página
 * (celular: puxar para atualizar) — apagar o convidado na hora perdia a
 * sessão E a partida. Agora a exclusão é agendada (padrão 90s) e cancelada
 * se a sessão voltar (refresh do token). Fechou o navegador de verdade →
 * ninguém volta → apaga.
 */
const saidasPendentes = new Map<string, NodeJS.Timeout>()

export function scheduleGuestLeave(
  prisma: PrismaClient,
  userId: string,
  opts?: { graceMs?: number; aindaOnline?: () => boolean },
): void {
  const ms = opts?.graceMs ?? Number(process.env.GUEST_LEAVE_GRACE_MS ?? 90_000)
  cancelGuestLeave(userId)
  if (ms <= 0) {
    void deleteGuest(prisma, userId)
    return
  }
  const timer = setTimeout(() => {
    saidasPendentes.delete(userId)
    // outra aba do convidado continua conectada? então ele NÃO saiu —
    // o pagehide da última aba agenda de novo quando fechar de verdade
    if (opts?.aindaOnline?.()) return
    void deleteGuest(prisma, userId)
  }, ms)
  timer.unref?.()
  saidasPendentes.set(userId, timer)
}

/** a sessão do convidado voltou (reload) — cancela a exclusão agendada */
export function cancelGuestLeave(userId: string): void {
  const timer = saidasPendentes.get(userId)
  if (timer) {
    clearTimeout(timer)
    saidasPendentes.delete(userId)
  }
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
