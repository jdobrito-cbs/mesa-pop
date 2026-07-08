import type { GameFamily } from './games.js'
import type { UserPublic } from './types.js'

/** Jogo como vem do banco (o toggle do admin vive em isEnabled). */
export interface GameView {
  id: string
  slug: string
  name: string
  description: string
  family: GameFamily
  minPlayers: number
  maxPlayers: number
  color: string
  icon: string
  phase: number
  isEnabled: boolean
}

export interface AnnouncementView {
  id: string
  title: string
  message: string
  isActive: boolean
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  newUsers7d: number
  dau: number
  mau: number
  matchesInProgress: number
  matchesTotal: number
  roomsOpen: number
  gamesEnabled: number
  gamesTotal: number
}

export interface UserAdminView extends UserPublic {
  isActive: boolean
  bannedUntil: string | null
  banReason: string | null
  /** bloqueada por tentativas de login (aguarda o admin desbloquear) */
  locked: boolean
  failedLogins: number
  updatedAt: string
}

export interface PlatformSettings {
  /** tentativas de senha erradas até bloquear a conta */
  loginMaxAttempts: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export interface AuditEntryView {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  detail: unknown
  createdAt: string
  user: { id: string; email: string; displayName: string } | null
}

export interface GameRankingRow {
  gameId: string
  slug: string
  name: string
  icon: string
  color: string
  matches: number
}

export type PlayerRankingMetric = 'wins' | 'matches' | 'score'

export interface PlayerRankingRow {
  userId: string
  displayName: string
  email: string
  value: number
}

export interface RoomAdminView {
  id: string
  code: string
  isPrivate: boolean
  status: string
  players: number
  maxPlayers: number
  createdAt: string
  game: { slug: string; name: string; icon: string }
  host: { id: string; displayName: string }
}
