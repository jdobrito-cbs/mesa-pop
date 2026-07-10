import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { MILHAO_ESCADA, type MilhaoView } from '@mesapop/shared'
import { buildApp } from '../src/app'
import { MILHAO_DIFICIL, MILHAO_FACIL, MILHAO_MEDIO } from '../src/lib/milhaoPerguntas'

const runId = `mi${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let token = ''
let gameId = ''

const TODAS = [...MILHAO_FACIL, ...MILHAO_MEDIO, ...MILHAO_DIFICIL]

/** o TESTE conhece o banco — acha a alternativa correta pelo texto */
function idxCorreta(v: MilhaoView): number {
  const p = TODAS.find((q) => q.texto === v.pergunta!.texto)
  expect(p).toBeDefined()
  return v.pergunta!.alternativas.indexOf(p!.alts[0])
}

const auth = () => ({ authorization: `Bearer ${token}` })
const start = async () => (await app.inject({ method: 'POST', url: '/api/milhao/start', headers: auth() })).json() as MilhaoView
const responder = async (escolha: number) =>
  (await app.inject({ method: 'POST', url: '/api/milhao/responder', headers: auth(), body: { escolha } })).json() as MilhaoView

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  // garante o jogo no catálogo do banco de teste (o seed pode ser antigo)
  const g = await app.prisma.game.upsert({
    where: { slug: 'tio-mario-milionario' },
    create: {
      slug: 'tio-mario-milionario', name: 'Tio Mário Milionário', description: 'quiz de escada',
      family: 'PUZZLE', minPlayers: 1, maxPlayers: 1, color: 'pop-yellow', icon: '💰', phase: 9, isEnabled: true,
    },
    update: { isEnabled: true },
  })
  gameId = g.id
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    body: { email: `${runId}@t.local`, username: `u${runId}`, name: 'Testador do Milhao', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123' },
  })
  token = r.json().accessToken
})
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

describe('Tio Mário Milionário (servidor autoritativo)', () => {
  it('start abre no nível 0 SEM vazar a resposta correta', async () => {
    const v = await start()
    expect(v.fase).toBe('pergunta')
    expect(v.nivel).toBe(0)
    expect(v.valorPergunta).toBe(1000)
    expect(v.acumulado).toBe(0)
    expect(v.pergunta!.alternativas).toHaveLength(4)
    expect(JSON.stringify(v)).not.toContain('correta') // nada de gabarito na view
  })

  it('acertar sobe a escada; PARAR leva o acumulado e grava o ranking', async () => {
    let v = await start()
    v = await responder(idxCorreta(v))
    expect(v.nivel).toBe(1)
    expect(v.ultima?.certo).toBe(true)
    v = await responder(idxCorreta(v))
    expect(v.nivel).toBe(2)
    expect(v.acumulado).toBe(MILHAO_ESCADA[1]) // 2.000 garantidos

    const fim = (await app.inject({ method: 'POST', url: '/api/milhao/parar', headers: auth() })).json() as MilhaoView
    expect(fim.fase).toBe('fim')
    expect(fim.resultado).toBe('parou')
    expect(fim.premio).toBe(MILHAO_ESCADA[1])
    // o ranking é em PONTOS: prêmio/20 (o milhão vale 50.000)
    expect(fim.pontosGanhos).toBe(MILHAO_ESCADA[1]! / 20)

    const score = await app.prisma.score.findFirst({ where: { gameId, points: MILHAO_ESCADA[1]! / 20 } })
    expect(score).not.toBeNull()
  })

  it('errar leva METADE do acumulado', async () => {
    let v = await start()
    v = await responder(idxCorreta(v)) // acumulado 1000
    const errada = [0, 1, 2, 3].find((i) => i !== idxCorreta(v))!
    v = await responder(errada)
    expect(v.fase).toBe('fim')
    expect(v.resultado).toBe('errou')
    expect(v.premio).toBe(500)
    expect(v.pontosGanhos).toBe(25) // fração proporcional dos 50.000
    expect(v.ultima?.certo).toBe(false)
    expect(v.ultima?.correta).toBeDefined() // o gabarito SÓ aparece no reveal
  })

  it('cartas eliminam só ERRADAS; repetir a ajuda é recusado; pulo troca a pergunta', async () => {
    let v = await start()
    const r1 = await app.inject({ method: 'POST', url: '/api/milhao/ajuda', headers: auth(), body: { tipo: 'cartas' } })
    v = r1.json()
    expect(v.eliminadas.length).toBeGreaterThanOrEqual(1)
    expect(v.eliminadas).not.toContain(idxCorreta(v)) // a correta nunca sai
    const r2 = await app.inject({ method: 'POST', url: '/api/milhao/ajuda', headers: auth(), body: { tipo: 'cartas' } })
    expect(r2.statusCode).toBe(400)

    const antes = v.pergunta!.texto
    const r3 = await app.inject({ method: 'POST', url: '/api/milhao/ajuda', headers: auth(), body: { tipo: 'pulo' } })
    v = r3.json()
    expect(v.pulosRestantes).toBe(2)
    expect(v.pergunta!.texto).not.toBe(antes)
    expect(v.eliminadas).toHaveLength(0) // pulo limpa as ajudas de pergunta
  })

  it('plateia soma 100% e pende para a correta em pergunta fácil', async () => {
    const v = await start()
    const r = await app.inject({ method: 'POST', url: '/api/milhao/ajuda', headers: auth(), body: { tipo: 'plateia' } })
    const v2 = r.json() as MilhaoView
    expect(v2.plateia!.reduce((a, b) => a + b, 0)).toBe(100)
    expect(v2.plateia![idxCorreta(v)]).toBeGreaterThan(0)
  })

  it('estado retoma a MESMA pergunta (refresh não perde a partida)', async () => {
    const v = await start()
    const r = await app.inject({ method: 'GET', url: '/api/milhao/estado', headers: auth() })
    expect(r.statusCode).toBe(200)
    expect((r.json() as MilhaoView).pergunta!.texto).toBe(v.pergunta!.texto)
  })

  it('escada completa: o MILHÃO vale 50.000 pontos + 100 fichas de avatar', async () => {
    const antes = await app.prisma.user.findUnique({ where: { email: `${runId}@t.local` } })
    let v = await start()
    for (let i = 0; i < 16; i++) v = await responder(idxCorreta(v))
    expect(v.fase).toBe('fim')
    expect(v.resultado).toBe('milhao')
    expect(v.premio).toBe(1_000_000) // o R$ é cenográfico…
    expect(v.pontosGanhos).toBe(50_000) // …o ranking recebe PONTOS
    expect(v.fichasGanhas).toBe(100) // a view INFORMA o bônus para a tela final
    const mp = await app.prisma.matchPlayer.findFirst({ where: { score: 50_000 }, include: { match: true } })
    expect(mp?.isWinner).toBe(true)
    const depois = await app.prisma.user.findUnique({ where: { email: `${runId}@t.local` } })
    expect(depois!.fichas).toBe((antes!.fichas ?? 0) + 100) // fichas creditadas no banco
  })

  it('desistir no meio leva a FRAÇÃO de pontos e fichas (prêmio baixo = 0 ficha)', async () => {
    let v = await start()
    v = await responder(idxCorreta(v)) // acumulado R$ 1.000
    const fim = (await app.inject({ method: 'POST', url: '/api/milhao/parar', headers: auth() })).json() as MilhaoView
    expect(fim.pontosGanhos).toBe(50) // 1.000/20
    expect(fim.fichasGanhas).toBe(0) // 1.000/10.000 → ainda não rende ficha
  })
})
