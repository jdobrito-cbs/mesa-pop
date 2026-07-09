import { useEffect } from 'react'
import type {
  AdminStats,
  GameActivityRow,
  GamesActivity,
  OnlineOverview,
  OnlineUser,
} from '@mesapop/shared'
import { useFetch } from '../../lib/useFetch'

/** ritmo do refresh em tempo real da Visão geral */
const REFRESH_MS = 4000

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

/** lista de jogos com contagem de partidas (agora / histórico) */
function GameActivityList({
  title,
  emoji,
  rows,
  total,
  loading,
  accent,
  empty,
}: {
  title: string
  emoji: string
  rows: GameActivityRow[] | undefined
  total: number | undefined
  loading: boolean
  accent: string
  empty: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold">
          {emoji} {title}
        </h2>
        <span className={`font-display text-3xl font-extrabold tabular-nums ${accent}`}>
          {loading || total === undefined ? '…' : total}
        </span>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-text-muted">Carregando…</p>
      ) : rows && rows.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.slug} className="flex items-center gap-3">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg"
                style={{ backgroundColor: `${g.color}22` }}
              >
                {g.icon}
              </span>
              <span className="flex-1 truncate font-semibold">{g.name}</span>
              <span className="rounded-full bg-ink-800 px-2.5 py-0.5 text-sm font-bold tabular-nums text-text-muted ring-1 ring-ink-700">
                {g.matches}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">{empty}</p>
      )}
    </div>
  )
}

/** quem está conectado agora + o jogo em que está */
function OnlineList({
  title,
  emoji,
  users,
  accent,
  empty,
}: {
  title: string
  emoji: string
  users: OnlineUser[] | undefined
  accent: string
  empty: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold">
          {emoji} {title}
        </h2>
        <span className={`font-display text-3xl font-extrabold tabular-nums ${accent}`}>
          {users ? users.length : '…'}
        </span>
      </div>
      {!users ? (
        <p className="mt-3 text-sm text-text-muted">Carregando…</p>
      ) : users.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.userId} className="flex items-center gap-3">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pop-cyan/20 text-xs font-bold text-pop-cyan">
                {u.displayName.slice(0, 1).toUpperCase()}
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-pop-green ring-2 ring-ink-900" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{u.displayName}</span>
              {u.game ? (
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-0.5 text-xs font-bold ring-1 ring-ink-700"
                  style={{ color: u.game.color }}
                >
                  <span aria-hidden="true">{u.game.icon}</span>
                  {u.game.name}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-ink-800 px-2.5 py-0.5 text-xs text-text-muted ring-1 ring-ink-700">
                  no lobby
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">{empty}</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch<AdminStats>('/api/admin/stats')
  const { data: actData, loading: actLoading, reload: reloadAct } =
    useFetch<GamesActivity>('/api/admin/games-activity')
  const { data: onlineData, reload: reloadOnline } = useFetch<OnlineOverview>('/api/admin/online')
  const act = { data: actData, loading: actLoading }

  // tempo real: atualiza tudo a cada poucos segundos, SEM piscar a tela
  useEffect(() => {
    const id = setInterval(() => {
      void reload({ silent: true })
      void reloadAct({ silent: true })
      void reloadOnline({ silent: true })
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [reload, reloadAct, reloadOnline])

  return (
    <section>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-extrabold">Visão geral</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pop-green/15 px-2.5 py-1 text-xs font-bold text-pop-green">
          <span className="size-2 animate-pulse rounded-full bg-pop-green" aria-hidden="true" />
          ao vivo
        </span>
      </div>
      <p className="mt-1 text-text-muted">O pulso da mesa, atualizando sozinho.</p>

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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OnlineList
          title="Convidados online"
          emoji="🎟️"
          users={onlineData?.guests}
          accent="text-pop-cyan"
          empty="Nenhum convidado conectado agora."
        />
        <OnlineList
          title="Usuários online"
          emoji="🟢"
          users={onlineData?.users}
          accent="text-pop-green"
          empty="Nenhum usuário com conta conectado agora."
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GameActivityList
          title="Sendo jogados agora"
          emoji="🎮"
          rows={act.data?.now}
          total={act.data?.nowTotal}
          loading={act.loading}
          accent="text-pop-orange"
          empty="Nenhuma partida em andamento no momento."
        />
        <GameActivityList
          title="Já jogados no sistema"
          emoji="🏆"
          rows={act.data?.played}
          total={act.data?.playedTotal}
          loading={act.loading}
          accent="text-pop-purple"
          empty="Ainda não há partidas registradas."
        />
      </div>
    </section>
  )
}
