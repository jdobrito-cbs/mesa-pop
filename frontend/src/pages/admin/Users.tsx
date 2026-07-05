import { useState, type FormEvent } from 'react'
import type { Paginated, UserAdminView } from '@mesapop/shared'
import { api, ApiRequestError } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'
import { useAuth } from '../../lib/auth'
import Modal from '../../components/Modal'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

function statusOf(u: UserAdminView) {
  if (!u.isActive) return { label: 'Desativada', cls: 'bg-ink-700 text-text-muted' }
  if (u.bannedUntil && new Date(u.bannedUntil) > new Date())
    return { label: 'Banida', cls: 'bg-pop-orange/15 text-pop-orange' }
  return { label: 'Ativa', cls: 'bg-pop-green/15 text-pop-green' }
}

export default function Users() {
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<UserAdminView | null>(null)
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState('')

  const perPage = 10
  const url = `/api/admin/users?perPage=${perPage}&page=${page}${query ? `&search=${encodeURIComponent(query)}` : ''}`
  const { data, loading, error, reload } = useFetch<Paginated<UserAdminView>>(url)
  const pages = data ? Math.max(1, Math.ceil(data.total / perPage)) : 1

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  async function remove(u: UserAdminView) {
    if (!window.confirm(`Excluir ${u.email}? Esta ação não tem volta.`)) return
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      setFeedback(`Usuário ${u.email} excluído.`)
      await reload()
    } catch (err) {
      setFeedback(err instanceof ApiRequestError ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Usuários</h1>
          <p className="mt-1 text-text-muted">{data ? `${data.total} contas` : ' '}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/users/export.csv"
            className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
          >
            Exportar CSV
          </a>
          <button
            onClick={() => setCreating(true)}
            className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2 text-sm text-white"
          >
            Criar usuário
          </button>
        </div>
      </div>

      <form onSubmit={submitSearch} className="mt-5 flex gap-2">
        <input
          className="field max-w-sm"
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-pop px-5 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
          Buscar
        </button>
      </form>

      {feedback && <p className="mt-4 text-sm font-semibold text-pop-cyan">{feedback}</p>}
      {error && <p className="mt-4 text-pop-orange">{error}</p>}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs tracking-wide text-text-muted uppercase">
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cadastro</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {data?.items.map((u) => {
              const st = statusOf(u)
              return (
                <tr key={u.id} className="border-b border-ink-700/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.displayName}</div>
                    <div className="text-text-muted">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'ADMIN' ? (
                      <span className="rounded-full bg-pop-purple/15 px-3 py-1 text-xs font-bold text-pop-purple">
                        Admin
                      </span>
                    ) : (
                      <span className="text-text-muted">Jogador</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(u)}
                      className="btn-pop px-3 py-1.5 text-xs ring-1 ring-ink-700 hover:ring-pop-cyan"
                    >
                      Editar
                    </button>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => remove(u)}
                        className="btn-pop ml-2 px-3 py-1.5 text-xs text-pop-orange ring-1 ring-ink-700 hover:ring-pop-orange"
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-text-muted">
        <span>
          Página {page} de {pages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-pop px-4 py-1.5 ring-1 ring-ink-700 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-pop px-4 py-1.5 ring-1 ring-ink-700 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      </div>

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            void reload()
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            void reload()
          }}
        />
      )}
    </section>
  )
}

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ email: '', name: '', phone: '', password: '', role: 'USER' })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await api('/api/admin/users', { body: form })
      onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao criar usuário')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="Criar usuário" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <p className="text-sm font-semibold text-pop-orange">{error}</p>}
        <input className="field" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="field" type="tel" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="field" type="password" placeholder="Senha (mín. 8, com maiúscula, minúscula e número)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.role === 'ADMIN'}
            onChange={(e) => setForm({ ...form, role: e.target.checked ? 'ADMIN' : 'USER' })}
          />
          Conceder acesso de administrador
        </label>
        <button disabled={sending} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-3 text-white disabled:opacity-60">
          {sending ? 'Criando…' : 'Criar usuário'}
        </button>
      </form>
    </Modal>
  )
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onDone,
}: {
  user: UserAdminView
  isSelf: boolean
  onClose: () => void
  onDone: () => void
}) {
  const banned = user.bannedUntil && new Date(user.bannedUntil) > new Date()
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.isActive)
  const [banDays, setBanDays] = useState('')
  const [banReason, setBanReason] = useState(user.banReason ?? '')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const body: Record<string, unknown> = { name, role, isActive }
      if (banDays === 'clear') {
        body.bannedUntil = null
        body.banReason = null
      } else if (banDays) {
        body.bannedUntil = new Date(Date.now() + Number(banDays) * 86400000).toISOString()
        body.banReason = banReason || 'Sem motivo informado'
      }
      await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body })
      onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao salvar')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={`Editar ${user.email}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <p className="text-sm font-semibold text-pop-orange">{error}</p>}
        <label className="flex flex-col gap-1 text-sm font-bold">
          Nome
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={role === 'ADMIN'}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.checked ? 'ADMIN' : 'USER')}
          />
          Administrador {isSelf && <span className="text-text-muted">(você não pode se rebaixar)</span>}
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isSelf}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Conta ativa
        </label>

        <fieldset className="rounded-field border border-ink-700 p-3">
          <legend className="px-1 text-sm font-bold text-pop-orange">Banimento</legend>
          {banned && (
            <p className="mb-2 text-sm text-text-muted">
              Banida até {new Date(user.bannedUntil!).toLocaleString('pt-BR')} — “{user.banReason}”
            </p>
          )}
          <select className="field" value={banDays} onChange={(e) => setBanDays(e.target.value)}>
            <option value="">Sem alteração</option>
            <option value="1">Banir por 1 dia</option>
            <option value="7">Banir por 7 dias</option>
            <option value="30">Banir por 30 dias</option>
            <option value="36500">Banir permanentemente</option>
            {banned && <option value="clear">Remover banimento</option>}
          </select>
          {banDays && banDays !== 'clear' && (
            <input
              className="field mt-2"
              placeholder="Motivo do banimento"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          )}
        </fieldset>

        <button disabled={sending} className="btn-pop mt-1 bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-3 text-white disabled:opacity-60">
          {sending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </Modal>
  )
}
