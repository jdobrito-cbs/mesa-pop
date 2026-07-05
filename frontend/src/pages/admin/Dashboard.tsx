import type { AdminStats } from '@mesapop/shared'
import { useFetch } from '../../lib/useFetch'

const CARDS: Array<{ key: keyof AdminStats; label: string; color: string; hint?: string }> = [
  { key: 'totalUsers', label: 'Usuários', color: 'text-pop-purple' },
  { key: 'activeUsers', label: 'Contas ativas', color: 'text-pop-green' },
  { key: 'newUsers7d', label: 'Novos (7 dias)', color: 'text-pop-cyan' },
  { key: 'dau', label: 'Ativos hoje (DAU)', color: 'text-pop-yellow' },
  { key: 'mau', label: 'Ativos no mês (MAU)', color: 'text-pop-yellow' },
  { key: 'matchesInProgress', label: 'Partidas agora', color: 'text-pop-orange' },
  { key: 'roomsOpen', label: 'Salas abertas', color: 'text-pop-magenta' },
  { key: 'gamesEnabled', label: 'Jogos habilitados', color: 'text-pop-green' },
]

export default function Dashboard() {
  const { data, loading, error } = useFetch<AdminStats>('/api/admin/stats')

  return (
    <section>
      <h1 className="text-3xl font-extrabold">Visão geral</h1>
      <p className="mt-1 text-text-muted">O pulso da mesa, em tempo real.</p>

      {error && <p className="mt-6 text-pop-orange">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.key} className="card p-5">
            <p className="text-sm font-semibold text-text-muted">{c.label}</p>
            <p className={`mt-1 font-display text-4xl font-extrabold tabular-nums ${c.color}`}>
              {loading || !data ? '…' : data[c.key]}
            </p>
            {c.key === 'gamesEnabled' && data && (
              <p className="text-xs text-text-muted">de {data.gamesTotal} no catálogo</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
