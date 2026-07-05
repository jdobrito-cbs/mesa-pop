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
      name: process.env.ADMIN_NAME ?? 'Administrador',
      displayName: process.env.ADMIN_NAME ?? 'Administrador',
      phone: '0000000000',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
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
