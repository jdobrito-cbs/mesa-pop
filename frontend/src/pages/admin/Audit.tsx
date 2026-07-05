import { useState, type FormEvent } from 'react'
import type { AuditEntryView, Paginated } from '@mesapop/shared'
import { useFetch } from '../../lib/useFetch'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })

/** Rótulos amigáveis para as ações registradas. */
const ACTION_LABELS: Record<string, string> = {
  'user.register': 'Cadastro',
  'auth.login': 'Login',
  'auth.login_failed': 'Login falhou',
  'admin.user.create': 'Admin: criou usuário',
  'admin.user.update': 'Admin: editou usuário',
  'admin.user.delete': 'Admin: excluiu usuário',
  'admin.users.export': 'Admin: exportou CSV',
  'admin.game.toggle': 'Admin: alterou jogo',
  'admin.room.close': 'Admin: encerrou sala',
  'admin.announcement.create': 'Admin: criou aviso',
  'admin.announcement.update': 'Admin: editou aviso',
  'admin.announcement.delete': 'Admin: excluiu aviso',
}

export default function Audit() {
  const [email, setEmail] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState({ email: '', action: '', from: '', to: '' })
  const [page, setPage] = useState(1)

  const { data: actionsData } = useFetch<{ actions: string[] }>('/api/admin/audit/actions')

  const params = new URLSearchParams({ page: String(page), perPage: '15' })
  if (applied.email) params.set('email', applied.email)
  if (applied.action) params.set('action', applied.action)
  if (applied.from) params.set('from', new Date(applied.from).toISOString())
  if (applied.to) params.set('to', new Date(`${applied.to}T23:59:59`).toISOString())

  const { data, loading, error } = useFetch<Paginated<AuditEntryView>>(
    `/api/admin/audit?${params.toString()}`,
  )
  const pages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1

  function applyFilters(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setApplied({ email, action, from, to })
  }

  return (
    <section>
      <h1 className="text-3xl font-extrabold">Auditoria</h1>
      <p className="mt-1 text-text-muted">
        Toda ação sensível fica registrada — quem, quando e de onde.
      </p>

      <form onSubmit={applyFilters} className="mt-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-bold text-text-muted uppercase">
          Usuário
          <input className="field w-56" placeholder="e-mail…" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text-muted uppercase">
          Ação
          <select className="field w-52" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Todas</option>
            {actionsData?.actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text-muted uppercase">
          De
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text-muted uppercase">
          Até
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn-pop px-5 py-2.5 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
          Filtrar
        </button>
      </form>

      {error && <p className="mt-4 text-pop-orange">{error}</p>}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs tracking-wide text-text-muted uppercase">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">Carregando…</td></tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">Nada registrado nesse filtro.</td></tr>
            )}
            {data?.items.map((l) => (
              <tr key={l.id} className="border-b border-ink-700/50 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-text-muted tabular-nums">{fmt(l.createdAt)}</td>
                <td className="px-4 py-3 font-semibold">{ACTION_LABELS[l.action] ?? l.action}</td>
                <td className="px-4 py-3">
                  {l.user ? (
                    <>
                      <span className="font-bold">{l.user.displayName}</span>{' '}
                      <span className="text-text-muted">{l.user.email}</span>
                    </>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted tabular-nums">{l.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-text-muted">
        <span>{data ? `${data.total} registros` : ' '}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-pop px-4 py-1.5 ring-1 ring-ink-700 disabled:opacity-40">← Anterior</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-pop px-4 py-1.5 ring-1 ring-ink-700 disabled:opacity-40">Próxima →</button>
        </div>
      </div>
    </section>
  )
}
