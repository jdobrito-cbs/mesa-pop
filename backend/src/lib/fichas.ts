import type { PrismaClient } from '@prisma/client'

/**
 * Fichas por tempo de jogo: 1 ficha a cada 5 minutos ONLINE (presença por
 * socket, contas registradas). Um sweep por minuto credita os segundos; o
 * resto fica em memória (reinício perde só a fração — aceitável).
 */
const SEGUNDOS_POR_FICHA = 300
const acumulado = new Map<string, number>()

/** soma `segundos` para cada usuário presente e credita fichas completas */
export async function creditarSegundos(prisma: PrismaClient, userIds: string[], segundos: number): Promise<void> {
  for (const id of userIds) {
    const total = (acumulado.get(id) ?? 0) + segundos
    const fichas = Math.floor(total / SEGUNDOS_POR_FICHA)
    acumulado.set(id, total - fichas * SEGUNDOS_POR_FICHA)
    if (fichas > 0) {
      await prisma.user.updateMany({ where: { id, isGuest: false }, data: { fichas: { increment: fichas } } })
    }
  }
}

export function zerarAcumulo(): void {
  acumulado.clear()
}
