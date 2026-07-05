import type { RoomView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

const SEAT_LABEL = ['A', 'B', 'C', 'D']
const TEAMS = [
  { team: 0 as const, name: 'Dupla Magenta', dot: 'bg-pop-magenta', ring: 'ring-pop-magenta/50' },
  { team: 1 as const, name: 'Dupla Ciano', dot: 'bg-pop-cyan', ring: 'ring-pop-cyan/50' },
]

/**
 * Escolha de assento/dupla na sala de espera (Dominó; Xadrez no futuro).
 * A dupla é sempre quem senta em frente: assentos A+C vs B+D.
 */
export default function SeatPicker({
  room,
  myUserId,
  onError,
}: {
  room: RoomView
  myUserId: string
  onError: (msg: string) => void
}) {
  const me = room.players.find((p) => p.userId === myUserId)
  const iAmSpectator = !me
  const occupant = (seat: number) => room.players.find((p) => p.seat === seat)

  async function pick(input: { seat?: number; team?: 0 | 1 }) {
    const res = await emitAck('room:seat', input)
    if (!res.ok) onError(res.error ?? 'Não deu para sentar aí')
  }

  return (
    <div className="mt-6">
      <p className="text-center text-sm font-bold tracking-widest text-text-muted uppercase">
        Escolha seu lugar — a dupla é quem senta em frente
      </p>
      <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-4">
        {TEAMS.map(({ team, name, dot, ring }) => (
          <div key={team} className={`card p-4 ring-1 ${ring}`}>
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" /> {name}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[team, team + 2].map((seat) => {
                const p = occupant(seat)
                const isMe = p?.userId === myUserId
                return (
                  <div key={seat}>
                    {p ? (
                      <div
                        className={`flex items-center gap-2 rounded-field px-3 py-2 text-sm ring-1 ${
                          isMe ? 'bg-ink-700 font-bold ring-pop-yellow/60' : 'bg-ink-900 ring-ink-700'
                        }`}
                      >
                        <span className="font-mono text-xs text-text-muted">{SEAT_LABEL[seat]}</span>
                        <span className="truncate">{p.displayName}</span>
                        {isMe && <span className="text-xs text-pop-yellow">você</span>}
                        {!p.isConnected && <span className="text-xs text-pop-orange">caiu</span>}
                      </div>
                    ) : (
                      <button
                        onClick={() => void pick({ seat })}
                        className="btn-pop w-full justify-start gap-2 rounded-field border-2 border-dashed border-ink-700 px-3 py-2 text-sm text-text-muted hover:border-pop-green hover:text-pop-green"
                      >
                        <span className="font-mono text-xs">{SEAT_LABEL[seat]}</span> Sentar aqui
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => void pick({ team })}
              className="btn-pop mt-3 w-full px-3 py-1.5 text-xs ring-1 ring-ink-700 hover:ring-pop-purple"
            >
              Entrar nesta dupla
            </button>
          </div>
        ))}
      </div>

      {/* fila de espera / espectadores */}
      {room.spectators.length > 0 && (
        <div className="mx-auto mt-5 max-w-lg">
          <p className="text-sm font-bold text-text-muted">
            🪑 Fila de espera ({room.spectators.length}) — quando uma dupla perde, os
            próximos entram
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {room.spectators.map((s, i) => (
              <span
                key={s.userId}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  s.userId === myUserId
                    ? 'bg-pop-yellow/15 text-pop-yellow ring-pop-yellow/50'
                    : 'bg-ink-800 text-text-muted ring-ink-700'
                }`}
              >
                {i + 1}º {s.displayName}
                {s.userId === myUserId && ' (você)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {iAmSpectator && (
        <p className="mt-4 text-center text-sm text-text-muted">
          Você está na fila — escolha uma dupla livre para sentar, ou aguarde ser chamado.
        </p>
      )}
    </div>
  )
}
