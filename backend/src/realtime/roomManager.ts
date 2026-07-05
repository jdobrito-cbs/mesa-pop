import crypto from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import type { ChatMessageView, GameEndView, RoomView } from '@mesapop/shared'
import { getGameModule, type GameModule } from '../games/module'

/** Tempo que um jogador desconectado tem para voltar antes do W.O. */
const RECONNECT_GRACE_MS = 60_000
/** Chat: histórico por sala e limites anti-flood. */
const CHAT_HISTORY_LIMIT = 100
const CHAT_MAX_LENGTH = 300
const CHAT_MIN_INTERVAL_MS = 500

export interface RoomUser {
  id: string
  displayName: string
}

interface LivePlayer {
  userId: string
  displayName: string
  socketId: string | null
  seat: number | null
}

export interface LiveRoom {
  id: string
  code: string
  gameId: string
  gameSlug: string
  gameName: string
  isPrivate: boolean
  hostId: string
  maxPlayers: number
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CLOSED'
  players: Map<string, LivePlayer>
  module: GameModule
  state: unknown | null
  matchId: string | null
  disconnectTimers: Map<string, NodeJS.Timeout>
  chat: ChatMessageView[]
  lastChatAt: Map<string, number>
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newCode(): string {
  return Array.from(crypto.randomBytes(6))
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('')
}

export class RoomManager {
  private roomsByCode = new Map<string, LiveRoom>()
  private roomCodeByUser = new Map<string, string>()

  constructor(
    private prisma: PrismaClient,
    private io: Server,
  ) {}

  toView(room: LiveRoom): RoomView {
    return {
      id: room.id,
      code: room.code,
      gameSlug: room.gameSlug,
      gameName: room.gameName,
      isPrivate: room.isPrivate,
      status: room.status,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      players: [...room.players.values()].map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        isConnected: p.socketId !== null,
        seat: p.seat,
      })),
    }
  }

  roomOf(userId: string): LiveRoom | null {
    const code = this.roomCodeByUser.get(userId)
    return code ? (this.roomsByCode.get(code) ?? null) : null
  }

  private broadcast(room: LiveRoom) {
    this.io.to(room.id).emit('room:update', this.toView(room))
  }

  private sendState(room: LiveRoom) {
    if (room.state === null) return
    for (const p of room.players.values()) {
      if (p.socketId && p.seat !== null) {
        this.io.to(p.socketId).emit('game:state', {
          state: room.module.getStateFor(room.state, p.seat),
          yourSeat: p.seat,
        })
      }
    }
  }

  async create(user: RoomUser, socketId: string, gameSlug: string, isPrivate: boolean) {
    const existing = this.roomOf(user.id)
    if (existing) {
      if (existing.status === 'PLAYING') throw new Error('Você já está numa partida')
      await this.leave(user.id)
    }

    const module = getGameModule(gameSlug)
    if (!module) throw new Error('Jogo indisponível')

    const game = await this.prisma.game.findUnique({ where: { slug: gameSlug } })
    if (!game || !game.isEnabled) throw new Error('Este jogo não está aceitando novas salas')

    let code = newCode()
    while (this.roomsByCode.has(code)) code = newCode()

    const dbRoom = await this.prisma.room.create({
      data: {
        code,
        gameId: game.id,
        hostId: user.id,
        isPrivate,
        maxPlayers: module.maxPlayers,
        players: { create: { userId: user.id } },
      },
    })

    const room: LiveRoom = {
      id: dbRoom.id,
      code,
      gameId: game.id,
      gameSlug,
      gameName: game.name,
      isPrivate,
      hostId: user.id,
      maxPlayers: module.maxPlayers,
      status: 'WAITING',
      players: new Map([
        [user.id, { userId: user.id, displayName: user.displayName, socketId, seat: null }],
      ]),
      module,
      state: null,
      matchId: null,
      disconnectTimers: new Map(),
      chat: [],
      lastChatAt: new Map(),
    }
    this.roomsByCode.set(code, room)
    this.roomCodeByUser.set(user.id, code)
    this.io.sockets.sockets.get(socketId)?.join(room.id)
    this.broadcast(room)
    return this.toView(room)
  }

  async join(user: RoomUser, socketId: string, code: string) {
    const room = this.roomsByCode.get(code.toUpperCase().trim())
    if (!room || room.status === 'CLOSED' || room.status === 'FINISHED') {
      throw new Error('Sala não encontrada — confira o código')
    }

    const already = room.players.get(user.id)
    if (already) {
      // reconexão: retoma o lugar
      already.socketId = socketId
      const timer = room.disconnectTimers.get(user.id)
      if (timer) {
        clearTimeout(timer)
        room.disconnectTimers.delete(user.id)
      }
      this.roomCodeByUser.set(user.id, room.code)
      this.io.sockets.sockets.get(socketId)?.join(room.id)
      this.io.to(socketId).emit('chat:history', room.chat)
      await this.prisma.roomPlayer.updateMany({
        where: { roomId: room.id, userId: user.id },
        data: { isConnected: true, leftAt: null },
      })
      this.broadcast(room)
      this.sendState(room)
      return this.toView(room)
    }

    if (room.status !== 'WAITING') throw new Error('A partida já começou')
    if (room.players.size >= room.maxPlayers) throw new Error('Sala cheia')

    const existing = this.roomOf(user.id)
    if (existing) {
      if (existing.status === 'PLAYING') throw new Error('Você já está numa partida')
      await this.leave(user.id)
    }

    room.players.set(user.id, {
      userId: user.id,
      displayName: user.displayName,
      socketId,
      seat: null,
    })
    this.roomCodeByUser.set(user.id, room.code)
    this.io.sockets.sockets.get(socketId)?.join(room.id)
    this.io.to(socketId).emit('chat:history', room.chat)
    await this.prisma.roomPlayer.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      create: { roomId: room.id, userId: user.id },
      update: { isConnected: true, leftAt: null },
    })
    this.broadcast(room)
    return this.toView(room)
  }

  async start(userId: string) {
    const room = this.roomOf(userId)
    if (!room) throw new Error('Você não está numa sala')
    if (room.hostId !== userId) throw new Error('Só o anfitrião pode começar')
    if (room.status !== 'WAITING') throw new Error('A partida já começou')
    if (room.players.size < room.module.minPlayers) {
      throw new Error(`Precisa de ${room.module.minPlayers} jogadores para começar`)
    }

    // sorteia os assentos
    const ids = [...room.players.keys()].sort(() => Math.random() - 0.5)
    ids.forEach((id, seat) => {
      room.players.get(id)!.seat = seat
    })

    room.state = room.module.init(ids.length)
    room.status = 'PLAYING'

    const match = await this.prisma.match.create({
      data: {
        gameId: room.gameId,
        roomId: room.id,
        players: {
          create: [...room.players.values()].map((p) => ({ userId: p.userId })),
        },
      },
    })
    room.matchId = match.id
    await this.prisma.room.update({ where: { id: room.id }, data: { status: 'PLAYING' } })

    this.broadcast(room)
    this.sendState(room)
  }

  async action(userId: string, action: unknown) {
    const room = this.roomOf(userId)
    if (!room || room.status !== 'PLAYING' || room.state === null) {
      throw new Error('Nenhuma partida em andamento')
    }
    const player = room.players.get(userId)
    if (!player || player.seat === null) throw new Error('Você não está nesta partida')

    const outcome = room.module.play(room.state, player.seat, action)
    if ('error' in outcome) throw new Error(outcome.error)
    room.state = outcome.state

    const result = room.module.result(room.state)
    this.sendState(room)
    if (result.finished) {
      const winner = [...room.players.values()].find((p) => p.seat === result.winnerSeat)
      await this.finish(room, winner?.userId ?? null, result.draw, 'normal')
    }
  }

  /** Chat geral da sala — sanitizado e com anti-flood. */
  sendChat(userId: string, rawText: unknown): void {
    const room = this.roomOf(userId)
    const player = room?.players.get(userId)
    if (!room || !player) throw new Error('Você não está numa sala')

    const text = String(rawText ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) throw new Error('Escreva alguma coisa primeiro')
    if (text.length > CHAT_MAX_LENGTH) throw new Error('Mensagem longa demais (máx. 300)')

    const now = Date.now()
    if (now - (room.lastChatAt.get(userId) ?? 0) < CHAT_MIN_INTERVAL_MS) {
      throw new Error('Calma! Espere um instante entre mensagens')
    }
    room.lastChatAt.set(userId, now)

    const message: ChatMessageView = {
      id: crypto.randomUUID(),
      userId,
      displayName: player.displayName,
      text,
      at: new Date(now).toISOString(),
    }
    room.chat.push(message)
    if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.shift()
    this.io.to(room.id).emit('chat:message', message)
  }

  async leave(userId: string) {
    const room = this.roomOf(userId)
    if (!room) return
    const player = room.players.get(userId)
    this.roomCodeByUser.delete(userId)
    if (!player) return

    if (room.status === 'PLAYING') {
      // abandono no meio da partida: W.O. para o adversário
      const opponent = [...room.players.values()].find((p) => p.userId !== userId)
      await this.finish(room, opponent?.userId ?? null, false, 'wo')
      return
    }

    room.players.delete(userId)
    await this.prisma.roomPlayer.updateMany({
      where: { roomId: room.id, userId },
      data: { leftAt: new Date(), isConnected: false },
    })

    if (room.players.size === 0) {
      room.status = 'CLOSED'
      this.roomsByCode.delete(room.code)
      await this.prisma.room.update({
        where: { id: room.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      return
    }
    if (room.hostId === userId) {
      room.hostId = [...room.players.keys()][0]!
    }
    this.broadcast(room)
  }

  /** Desconexão de socket: espera a volta; na partida, W.O. após o prazo. */
  async onDisconnect(userId: string, socketId: string) {
    const room = this.roomOf(userId)
    if (!room) return
    const player = room.players.get(userId)
    if (!player || player.socketId !== socketId) return

    player.socketId = null
    await this.prisma.roomPlayer.updateMany({
      where: { roomId: room.id, userId },
      data: { isConnected: false },
    })
    this.broadcast(room)

    if (room.status === 'WAITING') {
      // na espera, sair da aba = sair da sala (com pequena tolerância)
      const timer = setTimeout(() => void this.leave(userId), 15_000)
      room.disconnectTimers.set(userId, timer)
    } else if (room.status === 'PLAYING') {
      const timer = setTimeout(() => {
        const still = room.players.get(userId)
        if (still && still.socketId === null && room.status === 'PLAYING') {
          const opponent = [...room.players.values()].find((p) => p.userId !== userId)
          void this.finish(room, opponent?.userId ?? null, false, 'wo')
        }
      }, RECONNECT_GRACE_MS)
      room.disconnectTimers.set(userId, timer)
    }
  }

  private async finish(
    room: LiveRoom,
    winnerUserId: string | null,
    draw: boolean,
    reason: GameEndView['reason'],
  ) {
    room.status = 'FINISHED'
    for (const t of room.disconnectTimers.values()) clearTimeout(t)
    room.disconnectTimers.clear()

    if (room.matchId) {
      await this.prisma.match.update({
        where: { id: room.matchId },
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          stateSnapshot: room.state as object,
        },
      })
      if (winnerUserId) {
        await this.prisma.matchPlayer.updateMany({
          where: { matchId: room.matchId, userId: winnerUserId },
          data: { isWinner: true, placement: 1 },
        })
        await this.prisma.matchPlayer.updateMany({
          where: { matchId: room.matchId, userId: { not: winnerUserId } },
          data: { placement: 2 },
        })
      }
    }
    await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'FINISHED', closedAt: new Date() },
    })

    this.io.to(room.id).emit('game:end', { winnerUserId, draw, reason } satisfies GameEndView)
    this.broadcast(room)

    // libera os jogadores para novas salas
    for (const id of room.players.keys()) this.roomCodeByUser.delete(id)
    this.roomsByCode.delete(room.code)
  }
}
