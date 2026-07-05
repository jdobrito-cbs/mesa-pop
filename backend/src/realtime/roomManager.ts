import crypto from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import type { ChatMessageView, GameEndView, RoomView } from '@mesapop/shared'
import { getGameModule, type GameModule } from '../games/module'

/** Tempo que um jogador desconectado tem para voltar antes do W.O. */
const RECONNECT_GRACE_MS = 60_000
/** Na espera (ou como espectador), sair da aba remove da sala após este prazo. */
const WAITING_GRACE_MS = 15_000
/** Máximo de espectadores por sala. */
const SPECTATOR_LIMIT = 20
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

interface LiveSpectator {
  userId: string
  displayName: string
  socketId: string | null
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
  /** fila de espera / espectadores, em ordem de chegada */
  spectators: Map<string, LiveSpectator>
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
      spectators: [...room.spectators.values()].map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        isConnected: s.socketId !== null,
      })),
      features: {
        seatPicking: room.module.seatPicking ?? false,
        spectators: room.module.allowSpectators ?? false,
        rotation: room.module.rotation ?? false,
      },
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
    // espectadores: visão de assento -1 — sem mãos, nunca
    for (const s of room.spectators.values()) {
      if (s.socketId) {
        this.io.to(s.socketId).emit('game:state', {
          state: room.module.getStateFor(room.state, -1),
          yourSeat: -1,
        })
      }
    }
  }

  private clearTimer(room: LiveRoom, userId: string) {
    const timer = room.disconnectTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      room.disconnectTimers.delete(userId)
    }
  }

  async create(user: RoomUser, socketId: string, gameSlug: string, isPrivate: boolean) {
    const existing = this.roomOf(user.id)
    if (existing) {
      if (existing.status === 'PLAYING' && existing.players.has(user.id)) {
        throw new Error('Você já está numa partida')
      }
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
      spectators: new Map(),
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
    if (!room || room.status === 'CLOSED') {
      throw new Error('Sala não encontrada — confira o código')
    }

    const socket = this.io.sockets.sockets.get(socketId)

    // reconexão de jogador
    const asPlayer = room.players.get(user.id)
    if (asPlayer) {
      asPlayer.socketId = socketId
      this.clearTimer(room, user.id)
      this.roomCodeByUser.set(user.id, room.code)
      socket?.join(room.id)
      this.io.to(socketId).emit('chat:history', room.chat)
      await this.prisma.roomPlayer.updateMany({
        where: { roomId: room.id, userId: user.id },
        data: { isConnected: true, leftAt: null },
      })
      this.broadcast(room)
      this.sendState(room)
      return this.toView(room)
    }

    // reconexão de espectador
    const asSpectator = room.spectators.get(user.id)
    if (asSpectator) {
      asSpectator.socketId = socketId
      this.clearTimer(room, user.id)
      this.roomCodeByUser.set(user.id, room.code)
      socket?.join(room.id)
      this.io.to(socketId).emit('chat:history', room.chat)
      this.broadcast(room)
      this.sendState(room)
      return this.toView(room)
    }

    if (room.status === 'FINISHED') throw new Error('Esta sala já terminou')

    const existing = this.roomOf(user.id)
    if (existing) {
      if (existing.status === 'PLAYING' && existing.players.has(user.id)) {
        throw new Error('Você já está numa partida')
      }
      await this.leave(user.id)
    }

    // entra como jogador se a mesa tem lugar e ainda não começou
    if (room.status === 'WAITING' && room.players.size < room.maxPlayers) {
      room.players.set(user.id, {
        userId: user.id,
        displayName: user.displayName,
        socketId,
        seat: null,
      })
      this.roomCodeByUser.set(user.id, room.code)
      socket?.join(room.id)
      this.io.to(socketId).emit('chat:history', room.chat)
      await this.prisma.roomPlayer.upsert({
        where: { roomId_userId: { roomId: room.id, userId: user.id } },
        create: { roomId: room.id, userId: user.id },
        update: { isConnected: true, leftAt: null },
      })
      this.broadcast(room)
      return this.toView(room)
    }

    // mesa cheia (ou partida rolando): entra na fila como espectador
    if (room.module.allowSpectators) {
      if (room.spectators.size >= SPECTATOR_LIMIT) throw new Error('A arquibancada está lotada')
      room.spectators.set(user.id, {
        userId: user.id,
        displayName: user.displayName,
        socketId,
      })
      this.roomCodeByUser.set(user.id, room.code)
      socket?.join(room.id)
      this.io.to(socketId).emit('chat:history', room.chat)
      this.broadcast(room)
      this.sendState(room)
      return this.toView(room)
    }

    throw new Error(room.status === 'WAITING' ? 'Sala cheia' : 'A partida já começou')
  }

  /**
   * Escolha de assento OU dupla na sala de espera.
   * Duplas: assentos pares (0,2) = dupla 0; ímpares (1,3) = dupla 1.
   * Dupla cheia → automaticamente a outra. Espectador sentando vira jogador.
   */
  async pickSeat(userId: string, input: { seat?: number; team?: 0 | 1 }) {
    const room = this.roomOf(userId)
    if (!room) throw new Error('Você não está numa sala')
    if (!room.module.seatPicking) throw new Error('Este jogo não tem escolha de assento')
    if (room.status !== 'WAITING') throw new Error('A partida já começou')

    const taken = new Set(
      [...room.players.values()].filter((p) => p.seat !== null && p.userId !== userId).map((p) => p.seat!),
    )
    const free = Array.from({ length: room.maxPlayers }, (_, i) => i).filter((s) => !taken.has(s))

    let seat: number | undefined
    if (input.seat !== undefined) {
      if (!Number.isInteger(input.seat) || input.seat < 0 || input.seat >= room.maxPlayers) {
        throw new Error('Assento inválido')
      }
      if (taken.has(input.seat)) throw new Error('Este assento já está ocupado')
      seat = input.seat
    } else if (input.team === 0 || input.team === 1) {
      // primeiro lugar livre da dupla; cheia → a outra dupla
      seat =
        free.find((s) => s % 2 === input.team) ??
        free.find((s) => s % 2 !== input.team)
      if (seat === undefined) throw new Error('A mesa está cheia')
    } else {
      throw new Error('Escolha um assento ou uma dupla')
    }

    let player = room.players.get(userId)
    if (!player) {
      // espectador sentando: precisa de vaga na mesa
      const spectator = room.spectators.get(userId)
      if (!spectator) throw new Error('Você não está nesta sala')
      if (room.players.size >= room.maxPlayers) throw new Error('A mesa está cheia — aguarde ser chamado')
      room.spectators.delete(userId)
      player = {
        userId,
        displayName: spectator.displayName,
        socketId: spectator.socketId,
        seat: null,
      }
      room.players.set(userId, player)
      await this.prisma.roomPlayer.upsert({
        where: { roomId_userId: { roomId: room.id, userId } },
        create: { roomId: room.id, userId },
        update: { isConnected: true, leftAt: null },
      })
    }
    player.seat = seat
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

    // assentos: respeita os escolhidos; sorteia os demais nas vagas livres
    const chosen = new Set(
      [...room.players.values()].filter((p) => p.seat !== null).map((p) => p.seat!),
    )
    const freeSeats = Array.from({ length: room.players.size }, (_, i) => i)
      .filter((s) => !chosen.has(s))
      .sort(() => Math.random() - 0.5)
    for (const p of room.players.values()) {
      if (p.seat === null || p.seat >= room.players.size) {
        p.seat = freeSeats.shift()!
      }
    }

    room.state = room.module.init(room.players.size)
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
      const winnerIds = [...room.players.values()]
        .filter((p) => p.seat !== null && result.winnerSeats.includes(p.seat))
        .map((p) => p.userId)
      await this.finish(room, winnerIds, result.draw, 'normal')
    }
  }

  /** Chat geral da sala (jogadores E espectadores) — sanitizado, anti-flood. */
  sendChat(userId: string, rawText: unknown): void {
    const room = this.roomOf(userId)
    const member = room?.players.get(userId) ?? room?.spectators.get(userId)
    if (!room || !member) throw new Error('Você não está numa sala')

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
      displayName: member.displayName,
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
    this.roomCodeByUser.delete(userId)

    // espectador saindo: só remove da fila
    if (room.spectators.delete(userId)) {
      this.clearTimer(room, userId)
      this.broadcast(room)
      return
    }

    const player = room.players.get(userId)
    if (!player) return

    if (room.status === 'PLAYING') {
      // abandono no meio da partida: W.O. — os demais vencem
      const others = [...room.players.values()]
        .filter((p) => p.userId !== userId)
        .map((p) => p.userId)
      room.players.delete(userId)
      await this.prisma.roomPlayer.updateMany({
        where: { roomId: room.id, userId },
        data: { leftAt: new Date(), isConnected: false },
      })
      await this.finish(room, others, false, 'wo')
      return
    }

    room.players.delete(userId)
    this.clearTimer(room, userId)
    await this.prisma.roomPlayer.updateMany({
      where: { roomId: room.id, userId },
      data: { leftAt: new Date(), isConnected: false },
    })

    if (room.players.size === 0 && room.spectators.size === 0) {
      await this.closeRoom(room)
      return
    }
    if (room.hostId === userId) {
      room.hostId = [...room.players.keys()][0] ?? [...room.spectators.keys()][0]!
    }
    this.broadcast(room)
  }

  /** Desconexão de socket: espera a volta; na partida, W.O. após o prazo. */
  async onDisconnect(userId: string, socketId: string) {
    const room = this.roomOf(userId)
    if (!room) return

    const spectator = room.spectators.get(userId)
    if (spectator && spectator.socketId === socketId) {
      spectator.socketId = null
      this.broadcast(room)
      const timer = setTimeout(() => void this.leave(userId), WAITING_GRACE_MS)
      room.disconnectTimers.set(userId, timer)
      return
    }

    const player = room.players.get(userId)
    if (!player || player.socketId !== socketId) return

    player.socketId = null
    await this.prisma.roomPlayer.updateMany({
      where: { roomId: room.id, userId },
      data: { isConnected: false },
    })
    this.broadcast(room)

    if (room.status === 'WAITING') {
      const timer = setTimeout(() => void this.leave(userId), WAITING_GRACE_MS)
      room.disconnectTimers.set(userId, timer)
    } else if (room.status === 'PLAYING') {
      const timer = setTimeout(() => {
        const still = room.players.get(userId)
        if (still && still.socketId === null && room.status === 'PLAYING') {
          void this.leave(userId)
        }
      }, RECONNECT_GRACE_MS)
      room.disconnectTimers.set(userId, timer)
    }
  }

  private async closeRoom(room: LiveRoom) {
    room.status = 'CLOSED'
    for (const t of room.disconnectTimers.values()) clearTimeout(t)
    this.roomsByCode.delete(room.code)
    await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
  }

  private async finish(
    room: LiveRoom,
    winnerUserIds: string[],
    draw: boolean,
    reason: GameEndView['reason'],
  ) {
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
      if (winnerUserIds.length) {
        await this.prisma.matchPlayer.updateMany({
          where: { matchId: room.matchId, userId: { in: winnerUserIds } },
          data: { isWinner: true, placement: 1 },
        })
        await this.prisma.matchPlayer.updateMany({
          where: { matchId: room.matchId, userId: { notIn: winnerUserIds } },
          data: { placement: 2 },
        })
      }
    }

    this.io.to(room.id).emit('game:end', { winnerUserIds, draw, reason } satisfies GameEndView)

    // ROTAÇÃO (ex.: Dominó): perdedores vão para o fim da fila, próxima
    // dupla entra, vencedores ficam — e a sala volta para a espera.
    if (room.module.rotation && !draw && winnerUserIds.length) {
      const losers = [...room.players.values()].filter((p) => !winnerUserIds.includes(p.userId))
      const winnerSeatsFreed: number[] = []
      for (const loser of losers) {
        winnerSeatsFreed.push(loser.seat!)
        room.players.delete(loser.userId)
        room.spectators.set(loser.userId, {
          userId: loser.userId,
          displayName: loser.displayName,
          socketId: loser.socketId,
        })
      }
      // chama a próxima dupla da fila (em ordem de chegada, só conectados)
      const queue = [...room.spectators.values()].filter(
        (s) => s.socketId !== null && !losers.some((l) => l.userId === s.userId),
      )
      for (const seat of winnerSeatsFreed.sort()) {
        const next = queue.shift()
        if (!next) break
        room.spectators.delete(next.userId)
        room.players.set(next.userId, {
          userId: next.userId,
          displayName: next.displayName,
          socketId: next.socketId,
          seat,
        })
        await this.prisma.roomPlayer.upsert({
          where: { roomId_userId: { roomId: room.id, userId: next.userId } },
          create: { roomId: room.id, userId: next.userId },
          update: { isConnected: true, leftAt: null },
        })
      }
      room.status = 'WAITING'
      room.state = null
      room.matchId = null
      await this.prisma.room.update({ where: { id: room.id }, data: { status: 'WAITING' } })
      this.broadcast(room)
      return
    }

    // sem rotação: a sala termina e todos são liberados
    room.status = 'FINISHED'
    await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'FINISHED', closedAt: new Date() },
    })
    this.broadcast(room)
    for (const id of room.players.keys()) this.roomCodeByUser.delete(id)
    for (const id of room.spectators.keys()) this.roomCodeByUser.delete(id)
    this.roomsByCode.delete(room.code)
  }
}
