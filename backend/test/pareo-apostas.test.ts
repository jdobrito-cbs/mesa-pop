import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PAREO_ODDS, pareoBuildRace } from '@mesapop/shared'
import { buildApp } from '../src/app'
import { novoPareo, type PareoState } from '../src/games/pareo'
import { liquidarApostas, registrarAposta } from '../src/lib/pareoApostas'

const runId = `pa${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let userId = ''

const ROOM = `sala-${runId}`

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    body: { email: `${runId}@t.local`, username: `u${runId}`, name: 'Apostador Teste', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123' },
  })
  userId = r.json().user.id
  await app.prisma.user.update({ where: { id: userId }, data: { fichas: 1000 } })
})
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

const fichasDe = async () =>
  (await app.prisma.user.findUnique({ where: { id: userId }, select: { fichas: true } }))!.fichas

describe('Páreo — apostas autoritativas na carteira', () => {
  it('aposta válida DEBITA a carteira e registra o ledger', async () => {
    const state = novoPareo(1, [])
    const res = await registrarAposta(app.prisma, { userId, roomId: ROOM, state, numero: 1, lane: 0, valor: 100 })
    expect('erro' in res).toBe(false)
    if ('erro' in res) return
    expect(res.fichas).toBe(900)
    expect(res.odds).toBe(PAREO_ODDS[0])
    const bet = await app.prisma.pareoBet.findUnique({ where: { id: res.betId } })
    expect(bet?.resultado).toBe('pendente')
    expect(bet?.seed).toBe(state.seed)
  })

  it('rejeita: duplicada, fase errada, páreo trocado, valor/cavalo inválidos', async () => {
    const state = novoPareo(1, []) // MESMA sala/nº da aposta anterior
    const dup = await registrarAposta(app.prisma, { userId, roomId: ROOM, state, numero: 1, lane: 1, valor: 10 })
    expect(dup).toEqual({ erro: 'JA_APOSTOU' })

    const fechada = { ...novoPareo(2, []), fase: 'corrida' as const }
    expect(await registrarAposta(app.prisma, { userId, roomId: ROOM, state: fechada, numero: 2, lane: 0, valor: 10 }))
      .toEqual({ erro: 'FASE_ERRADA' })

    const s2 = novoPareo(3, [])
    expect(await registrarAposta(app.prisma, { userId, roomId: ROOM, state: s2, numero: 2, lane: 0, valor: 10 }))
      .toEqual({ erro: 'PAREO_TROCOU' })
    expect(await registrarAposta(app.prisma, { userId, roomId: ROOM, state: s2, numero: 3, lane: 0, valor: 33 }))
      .toEqual({ erro: 'VALOR_INVALIDO' })
    expect(await registrarAposta(app.prisma, { userId, roomId: ROOM, state: s2, numero: 3, lane: 9, valor: 10 }))
      .toEqual({ erro: 'CAVALO_INVALIDO' })
    expect(await fichasDe()).toBe(900) // nenhuma rejeição mexeu no saldo
  })

  it('saldo insuficiente é recusado SEM debitar', async () => {
    await app.prisma.user.update({ where: { id: userId }, data: { fichas: 5 } })
    const state = novoPareo(9, [])
    expect(await registrarAposta(app.prisma, { userId, roomId: `${ROOM}-b`, state, numero: 9, lane: 0, valor: 10 }))
      .toEqual({ erro: 'SEM_FICHAS' })
    expect(await fichasDe()).toBe(5)
    await app.prisma.user.update({ where: { id: userId }, data: { fichas: 1000 } })
  })

  it('liquidação paga valor × odds ao acertador e marca o perdedor — IDEMPOTENTE', async () => {
    // monta uma corrida CONHECIDA: seed fixa → vencedor determinístico
    const seed = 424242
    const vencedor = pareoBuildRace(seed).vencedor
    const perdedor = (vencedor + 1) % 4
    const state: PareoState = { ...novoPareo(5, []), seed, vencedor }
    state.largadaEm = Date.now() - 60_000 // corrida já terminou

    const ganha = await registrarAposta(app.prisma, { userId, roomId: `${ROOM}-c`, state, numero: 5, lane: vencedor, valor: 100 })
    expect('erro' in ganha).toBe(false)
    const antes = await fichasDe() // 900 (apostou 100)

    const r1 = await liquidarApostas(app.prisma)
    expect(r1.pagas).toBeGreaterThanOrEqual(1)
    const payoutEsperado = Math.round(100 * PAREO_ODDS[vencedor]!)
    expect(await fichasDe()).toBe(antes + payoutEsperado)

    // liquidar DE NOVO não paga em dobro
    const r2 = await liquidarApostas(app.prisma)
    expect(await fichasDe()).toBe(antes + payoutEsperado)
    expect(r2.pagas).toBe(0)

    // aposta perdedora: marca 'perdeu' com payout 0 (fichas já debitadas)
    const state6: PareoState = { ...novoPareo(6, []), seed, vencedor }
    state6.largadaEm = Date.now() - 60_000
    await registrarAposta(app.prisma, { userId, roomId: `${ROOM}-d`, state: state6, numero: 6, lane: perdedor, valor: 50 })
    const antesPerda = await fichasDe()
    await liquidarApostas(app.prisma)
    expect(await fichasDe()).toBe(antesPerda) // nada creditado
    const bet = await app.prisma.pareoBet.findFirst({ where: { roomId: `${ROOM}-d` } })
    expect(bet?.resultado).toBe('perdeu')
    expect(bet?.payout).toBe(0)
  })

  it('aposta pendente de corrida FUTURA não liquida antes da hora', async () => {
    const state = novoPareo(7, []) // largada ainda no futuro
    await registrarAposta(app.prisma, { userId, roomId: `${ROOM}-e`, state, numero: 7, lane: 0, valor: 10 })
    await liquidarApostas(app.prisma)
    const bet = await app.prisma.pareoBet.findFirst({ where: { roomId: `${ROOM}-e` } })
    expect(bet?.resultado).toBe('pendente')
  })

  it('convidado não aposta (rota devolve 403)', async () => {
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: `Torcida ${runId}` } })
    const token = g.json().accessToken
    const r = await app.inject({
      method: 'POST', url: '/api/pareo/apostar',
      headers: { authorization: `Bearer ${token}` },
      body: { numero: 1, lane: 0, valor: 10 },
    })
    expect(r.statusCode).toBe(403)
    await app.inject({ method: 'POST', url: '/api/auth/guest/leave', cookies: {} })
    await app.prisma.user.deleteMany({ where: { isGuest: true, displayName: `Torcida ${runId}` } })
  })
})
