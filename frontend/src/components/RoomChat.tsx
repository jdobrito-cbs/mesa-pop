import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessageView } from '@mesapop/shared'
import { connectSocket, emitAck } from '../lib/socket'
import { useAuth } from '../lib/auth'

/**
 * Chat geral da sala — presente em TODOS os jogos multijogador.
 * Histórico vem do servidor ao entrar/reconectar; mensagens em tempo real.
 */
export default function RoomChat({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const socket = connectSocket()
    const onHistory = (history: ChatMessageView[]) => setMessages(history)
    const onMessage = (msg: ChatMessageView) =>
      setMessages((prev) => [...prev.slice(-99), msg])
    socket.on('chat:history', onHistory)
    socket.on('chat:message', onMessage)
    return () => {
      socket.off('chat:history', onHistory)
      socket.off('chat:message', onMessage)
    }
  }, [])

  // rola para a última mensagem
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const res = await emitAck('chat:send', { text })
    if (!res.ok) {
      setError(res.error ?? 'Não deu para enviar')
      setTimeout(() => setError(''), 2500)
      return
    }
    setText('')
  }

  const hour = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`card flex flex-col ${className}`}>
      <p className="border-b border-ink-700 px-4 py-3 font-display text-sm font-bold">
        💬 Chat da mesa
      </p>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-text-muted">
            Diga um oi para a mesa! 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === user?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? 'bg-pop-purple/25 text-text' : 'bg-ink-900 ring-1 ring-ink-700'
                }`}
              >
                {!mine && (
                  <span className="mr-2 font-bold text-pop-cyan">{m.displayName}</span>
                )}
                <span className="break-words">{m.text}</span>
                <span className="ml-2 text-[10px] text-text-muted tabular-nums">{hour(m.at)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="px-4 pb-1 text-xs font-semibold text-pop-orange">{error}</p>}

      <form onSubmit={send} className="flex gap-2 border-t border-ink-700 p-3">
        <input
          className="field flex-1 py-2 text-sm"
          placeholder="Mensagem para a mesa…"
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Mensagem do chat"
        />
        <button
          disabled={!text.trim()}
          className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
