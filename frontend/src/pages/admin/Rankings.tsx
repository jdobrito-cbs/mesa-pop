import { useState } from 'react'
import type { GameRankingRow, GameView, PlayerRankingRow } from '@mesapop/shared'
import { useFetch } from '../../lib/useFetch'

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
]

const METRICS = [
  { value: 'wins', label: 'Vitórias' },
  { value: 'matches', label: 'Partidas' },
  { value: 'score', label: 'Recorde' },
]

function PeriodPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-ink-800 p-1 ring-1 ring-ink-700" role="group" aria-label="Período">
      {PERIODS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange(p.days)}
          aria-pressed={days === p.days}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            days === p.days ? 'bg-pop-purple text-white' : 'text-text-muted hover:text-text'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** Barras horizontais: série única (magnitude) → uma cor, rótulo direto no fim. */
function GamesChart({ rows }: { rows: GameRankingRow[] }) {
  const max = Math.max(...rows.map((r) => r.matches), 1)
  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Partidas por jogo">
      {rows.map((r) => (
        <div key={r.gameId} className="flex items-center gap-3" title={`${r.name}: ${r.matches} partidas`}>
          <span className="w-36 shrink-0 truncate text-sm font-semibold">
            <span aria-hidden="true">{r.icon}</span> {r.name}
          </span>
          <div className="h-5 flex-1 rounded-full bg-ink-900">
            <div
              className="h-5 rounded-full bg-pop-purple"
              style={{ width: `${Math.max((r.matches / max) * 100, 2)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums">{r.matches}</span>
        </div>
      ))}
    </div>
  )
}

export default function Rankings() {
  const [gameDays, setGameDays] = useState(30)
  const [playerDays, setPlayerDays] = useState(30)
  const [metric, setMetric] = useState('wins')
  const [gameSlug, setGameSlug] = useState('')

  const { data: gamesRank, loading: loadingGames } = useFetch<{ rows: GameRankingRow[] }>(
    `/api/admin/rankings/games?days=${gameDays}`,
  )
  const { data: allGames } = useFetch<{ games: GameView[] }>('/api/admin/games')
  const playersUrl = `/api/admin/rankings/players?metric=${metric}&days=${playerDays}${gameSlug ? `&gameSlug=${gameSlug}` : ''}`
  const { data: playersRank, loading: loadingPlayers } = useFetch<{ rows: PlayerRankingRow[] }>(playersUrl)

  return (
    <section className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Jogos mais jogados</h1>
            <p className="mt-1 text-text-muted">Partidas iniciadas por jogo no período.</p>
          </div>
          <PeriodPicker days={gameDays} onChange={setGameDays} />
        </div>
        <div className="card mt-4 p-5">
          {loadingGames && <p className="text-text-muted">Carregando…</p>}
          {!loadingGames && !gamesRank?.rows.length && (
            <p className="py-6 text-center text-text-muted">
              Nenhuma partida no período ainda — os números chegam junto com os jogos. 🎲
            </p>
          )}
          {!!gamesRank?.rows.length && <GamesChart rows={gamesRank.rows} />}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Maiores jogadores</h1>
            <p className="mt-1 text-text-muted">Leaderboard global ou por jogo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-40 py-2" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Métrica">
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select className="field w-44 py-2" value={gameSlug} onChange={(e) => setGameSlug(e.target.value)} aria-label="Jogo">
              <option value="">Todos os jogos</option>
              {allGames?.games.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
            <PeriodPicker days={playerDays} onChange={setPlayerDays} />
          </div>
        </div>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-xs tracking-wide text-text-muted uppercase">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Jogador</th>
                <th className="px-4 py-3 text-right">{METRICS.find((m) => m.value === metric)?.label}</th>
              </tr>
            </thead>
            <tbody>
              {loadingPlayers && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted">Carregando…</td></tr>
              )}
              {!loadingPlayers && !playersRank?.rows.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted">
                    O pódio está vazio — por enquanto. 🏆
                  </td>
                </tr>
              )}
              {playersRank?.rows.map((r, i) => (
                <tr key={r.userId} className="border-b border-ink-700/50 last:border-0">
                  <td className="px-4 py-3 font-display font-extrabold text-pop-yellow">{i + 1}º</td>
                  <td className="px-4 py-3">
                    <span className="font-bold">{r.displayName}</span>{' '}
                    <span className="text-text-muted">{r.email}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
