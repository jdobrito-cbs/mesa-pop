import { useState } from 'react'
import type { RoomAdminView } from '@mesapop/shared'
import { api, ApiRequestError } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

export default function Rooms() {
  const { data, loading, error, reload } = useFetch<{ rooms: RoomAdminView[] }>('/api/admin/rooms')
  const [feedback, setFeedback] = useState('')

  async function close(room: RoomAdminView) {
    if (!window.confirm(`Encerrar a sala ${room.code} (${room.game.name})?`)) return
    try {
      await api(`/api/admin/rooms/${room.id}/close`, { method: 'POST' })
      setFeedback(`Sala ${room.code} encerrada.`)
      await reload()
    } catch (err) {
      setFeedback(err instanceof ApiRequestError ? err.message : 'Erro ao encerrar sala')
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Salas ao vivo</h1>
          <p className="mt-1 text-text-muted">Salas em espera ou com partida rolando.</p>
        </div>
        <button onClick={() => void reload()} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
          Atualizar
        </button>
      </div>

      {feedback && <p className="mt-4 text-sm font-semibold text-pop-cyan">{feedback}</p>}
      {error && <p className="mt-4 text-pop-orange">{error}</p>}
      {loading && <p className="mt-6 text-text-muted">Carregando…</p>}

      {!loading && data?.rooms.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <p className="text-4xl" aria-hidden="true">🪑</p>
          <p className="mt-3 font-display text-lg font-bold">Nenhuma sala aberta agora</p>
          <p className="mt-1 text-sm text-text-muted">
            As salas aparecem aqui quando os jogos multiplayer entrarem na mesa (Fase 2).
          </p>
        </div>
      )}

      {!!data?.rooms.length && (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs tracking-wide text-text-muted uppercase">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Jogo</th>
                <th className="px-4 py-3">Anfitrião</th>
                <th className="px-4 py-3">Jogadores</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={r.id} className="border-b border-ink-700/50 last:border-0">
                  <td className="px-4 py-3 font-mono font-bold">{r.code}</td>
                  <td className="px-4 py-3">
                    <span aria-hidden="true">{r.game.icon}</span> {r.game.name}
                    {r.isPrivate && <span className="ml-2 rounded-full bg-ink-700 px-2 py-0.5 text-xs">privada</span>}
                  </td>
                  <td className="px-4 py-3">{r.host.displayName}</td>
                  <td className="px-4 py-3 tabular-nums">{r.players}/{r.maxPlayers}</td>
                  <td className="px-4 py-3">
                    {r.status === 'PLAYING' ? (
                      <span className="rounded-full bg-pop-green/15 px-3 py-1 text-xs font-bold text-pop-green">Jogando</span>
                    ) : (
                      <span className="rounded-full bg-pop-yellow/15 px-3 py-1 text-xs font-bold text-pop-yellow">Esperando</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => close(r)}
                      className="btn-pop px-3 py-1.5 text-xs text-pop-orange ring-1 ring-ink-700 hover:ring-pop-orange"
                    >
                      Encerrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
