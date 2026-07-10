import { PrismaClient } from '@prisma/client'
import { GAME_CATALOG } from '@mesapop/shared'
import { hashPassword } from '../src/lib/password'
import '../src/config' // carrega .env

const prisma = new PrismaClient()

async function main() {
  // Catálogo de jogos — upsert idempotente a partir da fonte em /shared.
  for (const [i, game] of GAME_CATALOG.entries()) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      create: {
        slug: game.slug,
        name: game.name,
        description: game.description,
        family: game.family,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        color: game.color,
        icon: game.icon,
        phase: game.phase,
        isEnabled: game.enabled,
        sortOrder: i,
      },
      // Em jogos já existentes, NÃO sobrescreve isEnabled (estado do admin).
      update: {
        name: game.name,
        description: game.description,
        family: game.family,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        color: game.color,
        icon: game.icon,
        phase: game.phase,
        sortOrder: i,
      },
    })
  }
  console.log(`✔ Catálogo: ${GAME_CATALOG.length} jogos`)

  // Remove jogos que saíram do catálogo (ex.: um jogo retirado) — o upsert
  // acima só cria/atualiza, então sem isto uma linha antiga fica no banco e
  // continua aparecendo em /api/games. Apaga com as dependências (FK).
  const slugs = GAME_CATALOG.map((g) => g.slug)
  const orfaos = await prisma.game.findMany({
    where: { slug: { notIn: slugs } },
    select: { id: true, slug: true },
  })
  for (const g of orfaos) {
    const matches = await prisma.match.findMany({ where: { gameId: g.id }, select: { id: true } })
    const mids = matches.map((m) => m.id)
    const rooms = await prisma.room.findMany({ where: { gameId: g.id }, select: { id: true } })
    const rids = rooms.map((r) => r.id)
    await prisma.score.deleteMany({ where: { gameId: g.id } })
    await prisma.matchPlayer.deleteMany({ where: { matchId: { in: mids } } })
    await prisma.match.deleteMany({ where: { gameId: g.id } })
    await prisma.favoriteRoom.deleteMany({ where: { roomId: { in: rids } } })
    await prisma.roomPlayer.deleteMany({ where: { roomId: { in: rids } } })
    await prisma.room.deleteMany({ where: { gameId: g.id } })
    await prisma.game.delete({ where: { id: g.id } })
    console.log(`✂ jogo fora do catálogo removido: ${g.slug}`)
  }

  // Admin inicial
  const email = (process.env.ADMIN_EMAIL ?? 'admin@mesapop.local').toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    console.log('• ADMIN_PASSWORD não definido — seed de admin ignorado')
    return
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } })
      console.log(`✔ Usuário ${email} promovido a ADMIN`)
    } else {
      console.log(`• Admin ${email} já existe`)
    }
    return
  }
  await prisma.user.create({
    data: {
      email,
      username: process.env.ADMIN_USERNAME ?? 'admin',
      name: process.env.ADMIN_NAME ?? 'Administrador',
      displayName: process.env.ADMIN_NAME ?? 'Administrador',
      phone: '0000000000',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      fichas: 100_000,
    },
  })
  console.log(`✔ Admin criado: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
