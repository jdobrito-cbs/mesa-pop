import type { PrismaClient, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'

/**
 * Registra uma ação sensível no AuditLog. Nunca lança: falha de auditoria
 * não pode derrubar a operação principal (mas é logada).
 */
export async function audit(
  prisma: PrismaClient,
  action: string,
  opts: {
    userId?: string | null
    req?: FastifyRequest
    detail?: Prisma.InputJsonValue
  } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: opts.userId ?? null,
        detail: opts.detail,
        ip: opts.req?.ip ?? null,
        userAgent: opts.req?.headers['user-agent'] ?? null,
      },
    })
  } catch (err) {
    opts.req?.log.error({ err, action }, 'falha ao gravar audit log')
  }
}
