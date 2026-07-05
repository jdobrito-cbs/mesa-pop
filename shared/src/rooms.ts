/** Protocolo cliente ⇄ servidor das salas e partidas (Socket.IO). */

export interface RoomPlayerView {
  userId: string
  displayName: string
  isConnected: boolean
  /** posição na partida (0 = primeiro a jogar) — definida no início */
  seat: number | null
}

export type RoomStatusView = 'WAITING' | 'PLAYING' | 'FINISHED' | 'CLOSED'

export interface RoomView {
  id: string
  code: string
  gameSlug: string
  gameName: string
  isPrivate: boolean
  status: RoomStatusView
  hostId: string
  maxPlayers: number
  players: RoomPlayerView[]
}

export interface ChatMessageView {
  id: string
  userId: string
  displayName: string
  text: string
  /** ISO timestamp */
  at: string
}

export interface GameEndView {
  winnerUserId: string | null
  draw: boolean
  /** motivo: 'normal' | 'wo' (abandono) */
  reason: 'normal' | 'wo'
}

export interface Ack<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

/** cliente → servidor */
export interface ClientEvents {
  'room:create': (
    input: { gameSlug: string; isPrivate: boolean },
    ack: (res: Ack<RoomView>) => void,
  ) => void
  'room:join': (input: { code: string }, ack: (res: Ack<RoomView>) => void) => void
  'room:leave': (ack: (res: Ack) => void) => void
  'room:start': (ack: (res: Ack) => void) => void
  'game:action': (input: { action: unknown }, ack: (res: Ack) => void) => void
  'chat:send': (input: { text: string }, ack: (res: Ack) => void) => void
}

/** servidor → cliente */
export interface ServerEvents {
  'room:update': (room: RoomView) => void
  'game:state': (payload: { state: unknown; yourSeat: number }) => void
  'game:end': (payload: GameEndView) => void
  'chat:message': (message: ChatMessageView) => void
  'chat:history': (messages: ChatMessageView[]) => void
}
