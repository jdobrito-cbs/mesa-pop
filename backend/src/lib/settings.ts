import type { PrismaClient } from '@prisma/client'

/**
 * Configurações da plataforma (tabela Setting, chave/valor). Guardamos
 * como texto e convertemos ao ler. Hoje: o limite de tentativas de login
 * antes do bloqueio da conta.
 */
export const SETTINGS = {
  loginMaxAttempts: { key: 'login.maxAttempts', default: 5, min: 3, max: 20 },
} as const

export async function getLoginMaxAttempts(prisma: PrismaClient): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS.loginMaxAttempts.key } })
  const n = row ? Number(row.value) : NaN
  if (!Number.isFinite(n)) return SETTINGS.loginMaxAttempts.default
  return Math.min(SETTINGS.loginMaxAttempts.max, Math.max(SETTINGS.loginMaxAttempts.min, Math.trunc(n)))
}

export async function setLoginMaxAttempts(prisma: PrismaClient, value: number): Promise<number> {
  const clamped = Math.min(
    SETTINGS.loginMaxAttempts.max,
    Math.max(SETTINGS.loginMaxAttempts.min, Math.trunc(value)),
  )
  await prisma.setting.upsert({
    where: { key: SETTINGS.loginMaxAttempts.key },
    create: { key: SETTINGS.loginMaxAttempts.key, value: String(clamped) },
    update: { value: String(clamped) },
  })
  return clamped
}

/** sentinela: bloqueio por força bruta dura até o admin liberar */
export const LOCK_FOREVER = new Date('9999-12-31T23:59:59.000Z')
