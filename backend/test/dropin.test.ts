import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioc, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import type { Ack, PareoView, RoomView } from '@mesapop/shared'

/**
 * Modo DROP-IN dos jogos públicos contínuos (Páreo/Cisco): a sala começa
 * sozinha com o 1º jogador, quem chega entra JOGANDO no meio, sair não
 * derruba a corrida dos outros, sala privada não existe e o quickjoin
 * abre outra sala quando a atual enche. Exige Postgres.
 */

const runId = `dr${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let baseUrl = ''
const sockets: Socket[] = []

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(baseUrl, { auth: { token }, transports: ['websocket'] })
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
    sockets.push(s)
  })
}

function emitAck<T>(socket: Socket, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => socket.emit(event, ...args, resolve))
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function registerUser(i: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: `${runId}-p${i}@t.local`, name: `Corredor ${i}`, phone: '11987654321',
      username: `u${runId}p${i}`, password: 'Senha123', passwordConfirm: 'Senha123',
    },
  })
  return res.json().accessToken as string
}

beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  await app.prisma.game.upsert({
    where: { slug: 'pareo' },
    create: {
      slug: 'pareo', name: 'Páreo', description: 'corrida', family: 'PARTY',
      minPlayers: 1, maxPlayers: 16, color: 'pop-orange', icon: '🐎', phase: 9, isEnabled: true,
    },
    update: { isEnabled: true },
  })
})

afterAll(async () => {
  sockets.forEach((s) => s.disconnect())
  await wait(150)
  // as salas criadas apontam para os usuários (FK do host) — saem antes
  await app.prisma.room.deleteMany({ where: { host: { email: { startsWith: runId } } } })
  await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } })
  await app.close()
})

describe('Páreo/Cisco — jogos públicos contínuos (drop-in)', () => {
  it('quickjoin do 1º jogador CRIA a sala já JOGANDO (sem espera nem Começar)', async () => {
    const s0 = await connect(await registerUser(0))
    const r = await emitAck<RoomView>(s0, 'room:quickjoin', { gameSlug: 'pareo' })
    expect(r.ok).toBe(true)
    expect(r.data!.status).toBe('PLAYING') // começou sozinho
    expect(r.data!.isPrivate).toBe(false)
    expect(r.data!.players).toHaveLength(1)
  })

  it('quem chega DEPOIS entra JOGANDO na mesma sala (não vira espectador)', async () => {
    const s1 = await connect(await registerUser(1))
    const r = await emitAck<RoomView>(s1, 'room:quickjoin', { gameSlug: 'pareo' })
    expect(r.ok).toBe(true)
    expect(r.data!.status).toBe('PLAYING')
    expect(r.data!.players).toHaveLength(2) // MESMA sala, como jogador
    expect(r.data!.spectators).toHaveLength(0)
    const seats = r.data!.players.map((p) => p.seat).sort()
    expect(seats).toEqual([0, 1]) // ganhou o próximo assento livre

    // e recebe o estado da corrida em andamento
    const view = await new Promise<PareoView>((resolve) => {
      s1.once('game:state', (p: { state: PareoView }) => resolve(p.state))
    })
    expect(view.fase).toBeDefined()
  })

  it('criar sala PRIVADA de um jogo contínuo vira pública (não existe privada)', async () => {
    const s2 = await connect(await registerUser(2))
    const r = await emitAck<RoomView>(s2, 'room:create', { gameSlug: 'pareo', isPrivate: true })
    expect(r.ok).toBe(true)
    expect(r.data!.isPrivate).toBe(false)
    expect(r.data!.status).toBe('PLAYING')
    await emitAck(s2, 'room:leave')
  })

  it('sala CHEIA → quickjoin abre outra sala automaticamente', async () => {
    // aperta o limite da sala viva para não precisar de 16 sockets
    const cheia = [...app.rooms['roomsByCode'].values()].find(
      (room: { gameSlug: string; status: string }) => room.gameSlug === 'pareo' && room.status === 'PLAYING',
    )!
    const original = cheia.maxPlayers
    cheia.maxPlayers = 2 // já tem 2 jogadores → cheia

    const s3 = await connect(await registerUser(3))
    const r = await emitAck<RoomView>(s3, 'room:quickjoin', { gameSlug: 'pareo' })
    expect(r.ok).toBe(true)
    expect(r.data!.status).toBe('PLAYING')
    expect(r.data!.code).not.toBe(cheia.code) // caiu numa sala NOVA
    expect(r.data!.players).toHaveLength(1)
    cheia.maxPlayers = original
  })

  it('sair NÃO derruba a corrida dos outros (sem W.O. em jogo contínuo)', async () => {
    // na sala original há os jogadores 0 e 1; o 1 vai embora
    const s1 = sockets[1]!
    const r = await emitAck(s1, 'room:leave')
    expect(r.ok).toBe(true)
    await wait(200)
    const sala = [...app.rooms['roomsByCode'].values()].find(
      (room: { gameSlug: string; players: Map<string, unknown> }) =>
        room.gameSlug === 'pareo' && room.players.size === 1,
    )
    expect(sala).toBeDefined()
    expect((sala as { status: string }).status).toBe('PLAYING') // corrida segue p/ quem ficou
  })

  it('FECHAR O NAVEGADOR libera a vaga rápido (carência curta do drop-in)', async () => {
    process.env.DROPIN_GRACE_MS = '300'
    const s4 = await connect(await registerUser(4))
    const r = await emitAck<RoomView>(s4, 'room:quickjoin', { gameSlug: 'pareo' })
    expect(r.ok).toBe(true)
    const code = r.data!.code
    const antes = app.rooms['roomsByCode'].get(code) as { players: Map<string, unknown> }
    const tamanhoAntes = antes.players.size

    s4.disconnect() // "fechou o navegador"
    await wait(900) // carência de 300ms + folga
    delete process.env.DROPIN_GRACE_MS

    const sala = app.rooms['roomsByCode'].get(code) as
      | { players: Map<string, unknown>; status: string }
      | undefined
    if (sala) {
      expect(sala.players.size).toBe(tamanhoAntes - 1) // vaga liberada
    } // sala pode ter fechado se ele era o único — também é a vaga liberada
  })
})
