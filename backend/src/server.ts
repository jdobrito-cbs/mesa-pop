import { buildApp } from './app'
import { config } from './config'
import { reapOldGuests } from './lib/guests'
import { abandonarPartidasOrfas, fecharSalasOrfas, reapSoloParadas } from './lib/matches'

const app = await buildApp()

// ao subir: encerra partidas E salas órfãs (nada fica "em andamento"/"aberto"
// após um restart — salas vivem em memória). Limpa a Visão geral.
await Promise.all([abandonarPartidasOrfas(app.prisma), fecharSalasOrfas(app.prisma)])
  .then(([m, s]) => (m || s) && app.log.info(`boot: ${m} partida(s) e ${s} sala(s) órfã(s) encerradas`))
  .catch((err) => app.log.warn({ err }, 'limpeza de órfãs no boot falhou'))

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

// partidas SOLO paradas há mais de 30min (jogador fechou a aba) → abandonadas,
// para não ficarem em "sendo jogados agora" para sempre.
const matchReaper = setInterval(
  () => {
    reapSoloParadas(app.prisma, 30).catch((err) => app.log.warn({ err }, 'reap de partidas solo falhou'))
  },
  10 * 60 * 1000, // a cada 10 min
)
matchReaper.unref()

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
