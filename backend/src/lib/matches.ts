import type { PrismaClient } from '@prisma/client'

/**
 * Higiene de partidas "em andamento". Partidas solo (sem sala) que ficam
 * IN_PROGRESS quando o jogador fecha a aba sem terminar poluíam a Visão geral
 * ("sendo jogados agora") para sempre. Além do abandono ao iniciar outra do
 * mesmo jogo, temos:
 *  - ao SUBIR o servidor: nada está realmente em andamento (as salas vivem em
 *    memória e somem no restart) → toda partida IN_PROGRESS vira ABANDONED.
 *  - periodicamente: partidas SOLO paradas há muito tempo viram ABANDONED.
 */

/** no boot: encerra órfãs (nenhuma partida está viva logo após reiniciar) */
export async function abandonarPartidasOrfas(prisma: PrismaClient): Promise<number> {
  const r = await prisma.match.updateMany({
    where: { status: 'IN_PROGRESS' },
    data: { status: 'ABANDONED', endedAt: new Date() },
  })
  return r.count
}

/** no boot: fecha salas órfãs (o RoomManager é em memória e some no restart) */
export async function fecharSalasOrfas(prisma: PrismaClient): Promise<number> {
  const r = await prisma.room.updateMany({
    where: { status: { in: ['WAITING', 'PLAYING'] } },
    data: { status: 'CLOSED', closedAt: new Date() },
  })
  return r.count
}

/** periódico: solo (roomId nulo) IN_PROGRESS parado além do limite → ABANDONED */
export async function reapSoloParadas(prisma: PrismaClient, minutos = 30): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000)
  const r = await prisma.match.updateMany({
    where: { status: 'IN_PROGRESS', roomId: null, startedAt: { lt: limite } },
    data: { status: 'ABANDONED', endedAt: new Date() },
  })
  return r.count
}
