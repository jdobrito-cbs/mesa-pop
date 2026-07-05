import path from 'node:path'
import fs from 'node:fs'

// Carrega .env da raiz do monorepo (ou local) sem dependência externa.
for (const candidate of ['../.env', './.env']) {
  const p = path.resolve(process.cwd(), candidate)
  if (fs.existsSync(p)) {
    try {
      process.loadEnvFile(p)
    } catch {
      // variáveis já definidas no ambiente têm precedência
    }
    break
  }
}

const env = process.env
const isProd = env.NODE_ENV === 'production'

if (isProd && !env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET é obrigatório em produção')
}

export const config = {
  isProd,
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? '0.0.0.0',
  accessSecret: env.JWT_ACCESS_SECRET ?? 'dev-only-access-secret',
  accessTtl: env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  cookieSecure: env.COOKIE_SECURE === 'true',
} as const

export const REFRESH_COOKIE = 'mp_refresh'
