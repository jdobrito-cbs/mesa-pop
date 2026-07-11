import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  CISCO_FINISH,
  CISCO_GALINHAS,
  CISCO_ODDS,
  CISCO_SIM_STEPS,
  ciscoBuildRace,
  type CiscoView,
} from '@mesapop/shared'
import { buildApp } from '../src/app'
import { avancaCicloCisco, ciscoModule, novoCisco, type CiscoState } from '../src/games/cisco'
import { liquidarApostasCisco, registrarApostaCisco } from '../src/lib/ciscoApostas'

describe('Cisco — simulação das galinhas (portada do protótipo)', () => {
  it('mesma seed = mesma corrida (ciscadas, ovos e vencedora)', () => {
    const a = ciscoBuildRace(123456)
    const b = ciscoBuildRace(123456)
    expect(a.vencedor).toBe(b.vencedor)
    expect(a.ordem).toEqual(b.ordem)
    expect(a.galinhas[0]!.ovos).toEqual(b.galinhas[0]!.ovos)
    for (let s = 0; s <= CISCO_SIM_STEPS; s += 50) {
      expect(a.galinhas[2]!.traj[s]).toBe(b.galinhas[2]!.traj[s])
      expect(a.galinhas[2]!.stateTraj[s]).toBe(b.galinhas[2]!.stateTraj[s])
    }
  })

  it('a vencedora CRUZA a linha e o ciscar é decisivo (ela também cisca)', () => {
    for (const seed of [7, 999, 424242, 2026]) {
      const r = ciscoBuildRace(seed)
      const w = r.galinhas[r.vencedor]!
      expect(w.traj[CISCO_SIM_STEPS]).toBeGreaterThanOrEqual(CISCO_FINISH)
      expect(r.winCrossT).toBeGreaterThan(0.5)
      expect(r.winCrossT).toBeLessThanOrEqual(1)
      // o CISCAR é genuíno: até a vencedora para de vez em quando
      const passosCiscando = Array.from(w.stateTraj).filter((v) => v === 1).length
      expect(passosCiscando).toBeGreaterThan(0)
      // e todas botam pelo menos um ovo pelo caminho
      r.galinhas.forEach((g) => expect(g.ovos.length).toBeGreaterThan(0))
    }
  })

  it('favoritismo calibrado: em muitas corridas, a favorita vence mais', () => {
    const vitorias = [0, 0, 0, 0]
    for (let seed = 1; seed <= 600; seed++) vitorias[ciscoBuildRace(seed).vencedor]!++
    expect(vitorias[0]).toBeGreaterThan(vitorias[3]!)
    expect(vitorias[0]! + vitorias[1]!).toBeGreaterThan(vitorias[2]! + vitorias[3]!)
    vitorias.forEach((v) => expect(v).toBeGreaterThan(20)) // todas vencem às vezes
  })

  it('odds fixas com margem da banca', () => {
    expect(CISCO_ODDS).toHaveLength(4)
    expect(CISCO_ODDS[0]).toBeLessThan(CISCO_ODDS[3]!)
  })
})

describe('Cisco — ciclo autoritativo (infra compartilhada com o Páreo)', () => {
  it('fases avançam pelos timestamps e a view não vaza a seed antes da largada', () => {
    const s = novoCisco(1, [])
    expect(s.fase).toBe('apostas')
    let v = ciscoModule.getStateFor(s, 0) as CiscoView
    expect(v.seed).toBeNull()
    expect(v.vencedor).toBeNull()

    avancaCicloCisco(s, s.faseFimEm)
    expect(s.fase).toBe('prelargada')
    v = ciscoModule.getStateFor(s, 0) as CiscoView
    expect(v.seed).toBeNull()

    avancaCicloCisco(s, s.largadaEm)
    expect(s.fase).toBe('corrida')
    v = ciscoModule.getStateFor(s, 0) as CiscoView
    expect(v.seed).toBe(s.seed)

    avancaCicloCisco(s, s.faseFimEm)
    expect(s.fase).toBe('cerimonia')
    expect(s.historico[0]).toBe(CISCO_GALINHAS[s.vencedor]!.nome)

    avancaCicloCisco(s, s.faseFimEm) // próxima corrida abre sozinha
    expect(s.numero).toBe(2)
    expect(s.fase).toBe('apostas')
  })
})

describe('Cisco — apostas na carteira (mesmo motor do Páreo)', () => {
  const runId = `ci${Math.random().toString(36).slice(2, 8)}`
  let app: FastifyInstance
  let userId = ''
  const ROOM = `galinheiro-${runId}`

  beforeAll(async () => {
    app = await buildApp({ disableRateLimit: true, logger: false })
    const r = await app.inject({
      method: 'POST', url: '/api/auth/register',
      body: { email: `${runId}@t.local`, username: `u${runId}`, name: 'Apostador do Cisco', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123' },
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

  it('aposta debita; duplicada/fase errada são recusadas sem mexer no saldo', async () => {
    const state = novoCisco(1, [])
    const ok = await registrarApostaCisco(app.prisma, { userId, roomId: ROOM, state, numero: 1, lane: 0, valor: 100 })
    expect('erro' in ok).toBe(false)
    expect(await fichasDe()).toBe(900)

    const dup = await registrarApostaCisco(app.prisma, { userId, roomId: ROOM, state, numero: 1, lane: 1, valor: 10 })
    expect(dup).toEqual({ erro: 'JA_APOSTOU' })
    const fechada: CiscoState = { ...novoCisco(2, []), fase: 'corrida' }
    expect(await registrarApostaCisco(app.prisma, { userId, roomId: ROOM, state: fechada, numero: 2, lane: 0, valor: 10 }))
      .toEqual({ erro: 'FASE_ERRADA' })
    expect(await fichasDe()).toBe(900)
  })

  it('liquidação paga valor × odds à acertadora e é idempotente', async () => {
    const seed = 424242
    const vencedor = ciscoBuildRace(seed).vencedor
    const state: CiscoState = { ...novoCisco(5, []), seed, vencedor }
    state.largadaEm = Date.now() - 60_000 // corrida já terminou

    await registrarApostaCisco(app.prisma, { userId, roomId: `${ROOM}-b`, state, numero: 5, lane: vencedor, valor: 100 })
    const antes = await fichasDe()

    const r1 = await liquidarApostasCisco(app.prisma)
    expect(r1.pagas).toBeGreaterThanOrEqual(1)
    const payout = Math.round(100 * CISCO_ODDS[vencedor]!)
    expect(await fichasDe()).toBe(antes + payout)

    const r2 = await liquidarApostasCisco(app.prisma) // NÃO paga em dobro
    expect(r2.pagas).toBe(0)
    expect(await fichasDe()).toBe(antes + payout)

    const bet = await app.prisma.ciscoBet.findFirst({ where: { roomId: `${ROOM}-b` } })
    expect(bet?.resultado).toBe('ganhou')
    expect(bet?.payout).toBe(payout)
  })

  it('convidado não aposta (rota devolve 403)', async () => {
    const g = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: `Galinheiro ${runId}` } })
    const token = g.json().accessToken
    const r = await app.inject({
      method: 'POST', url: '/api/cisco/apostar',
      headers: { authorization: `Bearer ${token}` },
      body: { numero: 1, lane: 0, valor: 10 },
    })
    expect(r.statusCode).toBe(403)
    await app.prisma.user.deleteMany({ where: { isGuest: true, displayName: `Galinheiro ${runId}` } })
  })
})
