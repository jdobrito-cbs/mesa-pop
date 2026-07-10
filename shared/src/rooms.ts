/** Protocolo cliente ⇄ servidor das salas e partidas (Socket.IO). */

export interface RoomPlayerView {
  userId: string
  displayName: string
  isConnected: boolean
  /** posição na partida (0 = primeiro a jogar) — definida no início */
  seat: number | null
  /** jogador controlado pelo computador (robô) */
  isBot?: boolean
  /** id do avatar procedural ativo */
  avatar?: string | null
  /** administrador da plataforma (nome em vermelho nos chats) */
  isAdmin?: boolean
}

export type RoomStatusView = 'WAITING' | 'PLAYING' | 'FINISHED' | 'CLOSED'

export interface SpectatorView {
  userId: string
  displayName: string
  isConnected: boolean
  /** id do avatar procedural ativo */
  avatar?: string | null
  /** administrador da plataforma (nome em vermelho nos chats) */
  isAdmin?: boolean
}

export interface RoomFeatures {
  /** jogadores escolhem assento/dupla na espera (ex.: Dominó) */
  seatPicking: boolean
  /** sala aceita espectadores (sem ver mãos) */
  spectators: boolean
  /** rotação: dupla que perde sai, próxima da fila entra */
  rotation: boolean
}

export interface RoomView {
  id: string
  code: string
  gameSlug: string
  gameName: string
  isPrivate: boolean
  status: RoomStatusView
  hostId: string
  minPlayers: number
  maxPlayers: number
  players: RoomPlayerView[]
  /** fila de espera / espectadores, em ordem de chegada */
  spectators: SpectatorView[]
  features: RoomFeatures
  /** opções escolhidas na criação (ex.: modo do co-op) */
  options: Record<string, unknown> | null
}

export interface ChatMessageView {
  id: string
  userId: string
  displayName: string
  /** id do avatar procedural do autor */
  avatar?: string | null
  /** autor é admin (nome em vermelho) */
  admin?: boolean
  text: string
  /** ISO timestamp */
  at: string
}

export interface GameEndView {
  /** vencedores (mais de um em jogos de dupla); vazio em empate */
  winnerUserIds: string[]
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
    input: { gameSlug: string; isPrivate: boolean; options?: Record<string, unknown> },
    ack: (res: Ack<RoomView>) => void,
  ) => void
  /** cria uma sala privada já com robô(s) sentado(s) e começa a partida */
  'room:createVsBot': (
    input: { gameSlug: string; options?: Record<string, unknown> },
    ack: (res: Ack<RoomView>) => void,
  ) => void
  'room:join': (input: { code: string }, ack: (res: Ack<RoomView>) => void) => void
  'room:leave': (ack: (res: Ack) => void) => void
  'room:start': (ack: (res: Ack) => void) => void
  /** escolher assento OU dupla (dupla cheia → vai para a outra) */
  'room:seat': (input: { seat?: number; team?: 0 | 1 }, ack: (res: Ack) => void) => void
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
