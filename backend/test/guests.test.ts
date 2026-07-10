import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { hashPassword } from '../src/lib/password'
import { REFRESH_COOKIE } from '../src/config'

/**
 * Convidados ("jogar sem conta"): conta TEMPORÁRIA (some ao sair/fechar o
 * navegador), NOME ÚNICO enquanto existe, mas contabilizada no relatório
 * mensal (GuestVisit sobrevive à remoção).
 */
const runId = `gst${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `${runId}-admin@teste.mesapop.local`
const password = 'Senha123'
const nome = `Convidado ${runId}`

let app: FastifyInstance
let adminToken = ''

const asAdmin = () => ({ authorization: `Bearer ${adminToken}` })

/** cria um convidado e devolve o cookie de refresh emitido */
async function criarConvidado(name: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name } })
  const cookie = res.cookies.find((c) => c.name === REFRESH_COOKIE)
  return { res, refresh: cookie?.value ?? '' }
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin Convidados',
      displayName: 'Admin Convidados',
      phone: '',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  })
  adminToken = (
    await app.inject({ method: 'POST', url: '/api/auth/login', body: { email: adminEmail, password } })
  ).json().accessToken
})

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { endsWith: '@teste.mesapop.local' } } })
  await app.prisma.user.deleteMany({ where: { isGuest: true, displayName: { startsWith: 'Convidado gst' } } })
  await app.prisma.guestVisit.deleteMany({ where: { name: { startsWith: 'Convidado gst' } } })
  await app.close()
})

describe('Convidados temporários', () => {
  it('cria o convidado, registra a visita e recusa nome repetido', async () => {
    const { res } = await criarConvidado(nome)
    expect(res.statusCode).toBe(201)
    expect(res.json().user.isGuest).toBe(true)

    // a visita fica registrada para o relatório mensal
    const visitas = await app.prisma.guestVisit.count({ where: { name: nome } })
    expect(visitas).toBe(1)

    // mesmo nome (case-insensitive) enquanto o convidado existe → 409
    const dup = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      body: { name: nome.toUpperCase() },
    })
    expect(dup.statusCode).toBe(409)
    expect(dup.json().error).toBe('GUEST_NAME_TAKEN')
  })

  it('convidados não aparecem na lista de contas, mas sim na área exclusiva', async () => {
    const lista = await app.inject({ method: 'GET', url: '/api/admin/users?perPage=100', headers: asAdmin() })
    const temConvidado = (lista.json().items as { isGuest: boolean }[]).some((u) => u.isGuest)
    expect(temConvidado).toBe(false)

    const guests = await app.inject({ method: 'GET', url: '/api/admin/guests', headers: asAdmin() })
    const body = guests.json()
    expect(body.items.some((g: { name: string }) => g.name === nome)).toBe(true)
    expect(body.online).toBeGreaterThanOrEqual(1)
    expect(body.monthCount).toBeGreaterThanOrEqual(1)
  })

  it('ao SAIR o convidado é apagado, mas a contagem mensal permanece', async () => {
    const outroNome = `${nome} B`
    const { refresh } = await criarConvidado(outroNome)
    const mesAntes = (await app.inject({ method: 'GET', url: '/api/admin/guests', headers: asAdmin() })).json()
      .monthCount

    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [REFRESH_COOKIE]: refresh },
    })

    // o usuário-convidado sumiu
    const aindaExiste = await app.prisma.user.count({ where: { isGuest: true, displayName: outroNome } })
    expect(aindaExiste).toBe(0)

    // o relatório mensal NÃO diminuiu (a visita permanece)
    const mesDepois = (await app.inject({ method: 'GET', url: '/api/admin/guests', headers: asAdmin() })).json()
      .monthCount
    expect(mesDepois).toBe(mesAntes)

    // e o nome liberado pode ser reutilizado
    const reuso = await criarConvidado(outroNome)
    expect(reuso.res.statusCode).toBe(201)
  })

  it('/guest/leave (fechar o navegador) apaga o convidado após a carência', async () => {
    const nomeC = `${nome} C`
    const { refresh } = await criarConvidado(nomeC)
    // carência zero = apaga já (o padrão em produção é 90s, p/ reload não perder a sessão)
    process.env.GUEST_LEAVE_GRACE_MS = '0'
    await app.inject({
      method: 'POST',
      url: '/api/auth/guest/leave',
      cookies: { [REFRESH_COOKIE]: refresh },
    })
    delete process.env.GUEST_LEAVE_GRACE_MS
    await new Promise((r) => setTimeout(r, 50)) // a exclusão com carência 0 é assíncrona
    const existe = await app.prisma.user.count({ where: { isGuest: true, displayName: nomeC } })
    expect(existe).toBe(0)
  })

  it('/guest/leave num RELOAD não perde o convidado (refresh cancela a carência)', async () => {
    const nomeD = `${nome} D`
    const { refresh } = await criarConvidado(nomeD)
    // pagehide do reload: agenda a exclusão (carência longa) SEM revogar a sessão
    process.env.GUEST_LEAVE_GRACE_MS = '60000'
    await app.inject({
      method: 'POST',
      url: '/api/auth/guest/leave',
      cookies: { [REFRESH_COOKIE]: refresh },
    })
    delete process.env.GUEST_LEAVE_GRACE_MS
    // a página voltou: a sessão se restaura pelo cookie → cancela a exclusão
    const volta = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: refresh },
    })
    expect(volta.statusCode).toBe(200)
    expect(volta.json().user.displayName).toBe(nomeD)
    const existe = await app.prisma.user.count({ where: { isGuest: true, displayName: nomeD } })
    expect(existe).toBe(1)
  })
})
