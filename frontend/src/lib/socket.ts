import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from './api'

/**
 * Socket único da aplicação. O token é lido a cada (re)conexão — assim uma
 * reconexão depois do refresh de sessão usa o access token novo.
 */
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || '/', {
      autoConnect: false,
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
    })
  }
  if (!socket.connected && !socket.active) socket.connect()
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
}

/** emit com ack tipado e timeout */
export function emitAck<T = unknown>(
  event: string,
  ...args: unknown[]
): Promise<{ ok: boolean; error?: string; data?: T }> {
  return new Promise((resolve) => {
    connectSocket()
      .timeout(8000)
      .emit(event, ...args, (err: unknown, res: { ok: boolean; error?: string; data?: T }) => {
        if (err) resolve({ ok: false, error: 'Sem resposta do servidor — tente de novo' })
        else resolve(res)
      })
  })
}
