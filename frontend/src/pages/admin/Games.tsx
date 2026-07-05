import { useState } from 'react'
import type { GameView } from '@mesapop/shared'
import { api, ApiRequestError } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

type GameRow = GameView & { _count: { matches: number; rooms: number } }

export default function Games() {
  const { data, loading, error, reload } = useFetch<{ games: GameRow[] }>('/api/admin/games')
  const [feedback, setFeedback] = useState('')

  async function toggle(game: GameRow) {
    setFeedback('')
    try {
      await api(`/api/admin/games/${game.id}`, {
        method: 'PATCH',
        body: { isEnabled: !game.isEnabled },
      })
      setFeedback(
        game.isEnabled
          ? `${game.name} desabilitado — saiu do lobby e salas em espera foram fechadas.`
          : `${game.name} habilitado — já aparece no lobby.`,
      )
      await reload()
    } catch (err) {
      setFeedback(err instanceof ApiRequestError ? err.message : 'Erro ao alterar jogo')
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-extrabold">Jogos</h1>
      <p className="mt-1 text-text-muted">
        Habilite quando o jogo estiver pronto. Desabilitar tira do lobby e fecha
        salas em espera; partidas em andamento podem terminar.
      </p>

      {feedback && <p className="mt-4 text-sm font-semibold text-pop-cyan">{feedback}</p>}
      {error && <p className="mt-4 text-pop-orange">{error}</p>}
      {loading && <p className="mt-6 text-text-muted">Carregando…</p>}

      <div className="mt-5 grid gap-3">
        {data?.games.map((g) => (
          <div key={g.id} className="card flex items-center gap-4 p-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink-700 text-2xl" aria-hidden="true">
              {g.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold">{g.name}</h2>
                <span className="rounded-full bg-ink-700 px-2.5 py-0.5 text-xs font-bold text-text-muted">
                  Fase {g.phase}
                </span>
              </div>
              <p className="truncate text-sm text-text-muted">
                {g._count.matches} partidas · {g._count.rooms} salas criadas
              </p>
            </div>
            <button
              role="switch"
              aria-checked={g.isEnabled}
              aria-label={`${g.isEnabled ? 'Desabilitar' : 'Habilitar'} ${g.name}`}
              onClick={() => toggle(g)}
              className={`relative h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors ${
                g.isEnabled ? 'bg-pop-green' : 'bg-ink-700'
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-cream transition-all ${
                  g.isEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
