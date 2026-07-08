import { buildApp } from './app'
import { config } from './config'
import { reapOldGuests } from './lib/guests'

const app = await buildApp()

// rede de segurança: convidados esquecidos (fecharam o navegador sem o beacon
// disparar) são removidos de tempos em tempos. O caso normal (sair/fechar) já
// apaga na hora via logout e /api/auth/guest/leave.
const guestReaper = setInterval(
  () => {
    reapOldGuests(app.prisma, 12).catch((err) => app.log.warn({ err }, 'reap de convidados falhou'))
  },
  60 * 60 * 1000, // de hora em hora
)
guestReaper.unref()

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
