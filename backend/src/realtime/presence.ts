import type { RoomUser } from './roomManager'

export interface OnlinePerson {
  userId: string
  displayName: string
  isGuest: boolean
}

/**
 * Presença online: quem tem pelo menos um socket conectado agora. Suporta
 * várias abas por usuário (conjunto de socketIds); o usuário só sai da lista
 * quando fecha a última conexão. Em memória (zera se o servidor reinicia).
 */
export class Presence {
  private sockets = new Map<string, Set<string>>()
  private info = new Map<string, OnlinePerson>()

  add(user: RoomUser, socketId: string): void {
    let set = this.sockets.get(user.id)
    if (!set) {
      set = new Set()
      this.sockets.set(user.id, set)
    }
    set.add(socketId)
    this.info.set(user.id, {
      userId: user.id,
      displayName: user.displayName,
      isGuest: !!user.isGuest,
    })
  }

  remove(userId: string, socketId: string): void {
    const set = this.sockets.get(userId)
    if (!set) return
    set.delete(socketId)
    if (set.size === 0) {
      this.sockets.delete(userId)
      this.info.delete(userId)
    }
  }

  list(): OnlinePerson[] {
    return [...this.info.values()]
  }

  /** ainda tem alguma aba/socket conectado? */
  isOnline(userId: string): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0
  }
}
