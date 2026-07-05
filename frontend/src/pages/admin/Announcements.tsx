import { useState, type FormEvent } from 'react'
import type { AnnouncementView } from '@mesapop/shared'
import { api, ApiRequestError } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

export default function Announcements() {
  const { data, loading, error, reload } = useFetch<{ announcements: AnnouncementView[] }>(
    '/api/admin/announcements',
  )
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)

  async function create(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setFeedback('')
    try {
      await api('/api/admin/announcements', { body: { title, message, isActive: true } })
      setTitle('')
      setMessage('')
      setFeedback('Aviso publicado no lobby.')
      await reload()
    } catch (err) {
      setFeedback(err instanceof ApiRequestError ? err.message : 'Erro ao publicar aviso')
    } finally {
      setSending(false)
    }
  }

  async function toggle(a: AnnouncementView) {
    await api(`/api/admin/announcements/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } })
    await reload()
  }

  async function remove(a: AnnouncementView) {
    if (!window.confirm(`Excluir o aviso “${a.title}”?`)) return
    await api(`/api/admin/announcements/${a.id}`, { method: 'DELETE' })
    await reload()
  }

  return (
    <section>
      <h1 className="text-3xl font-extrabold">Avisos</h1>
      <p className="mt-1 text-text-muted">Publicados no lobby de todos os jogadores.</p>

      <form onSubmit={create} className="card mt-5 flex flex-col gap-3 p-5">
        <input className="field" placeholder="Título (ex.: Manutenção no sábado)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="field min-h-20" placeholder="Mensagem para os jogadores…" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button disabled={sending || !title || !message} className="btn-pop self-start bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-2.5 text-sm text-white disabled:opacity-50">
          {sending ? 'Publicando…' : 'Publicar aviso'}
        </button>
        {feedback && <p className="text-sm font-semibold text-pop-cyan">{feedback}</p>}
      </form>

      {error && <p className="mt-4 text-pop-orange">{error}</p>}
      {loading && <p className="mt-6 text-text-muted">Carregando…</p>}

      <div className="mt-5 grid gap-3">
        {!loading && data?.announcements.length === 0 && (
          <p className="text-text-muted">Nenhum aviso criado ainda.</p>
        )}
        {data?.announcements.map((a) => (
          <div key={a.id} className="card flex items-start gap-4 p-4">
            <span className="text-2xl" aria-hidden="true">📣</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display font-bold">{a.title}</h2>
                {a.isActive ? (
                  <span className="rounded-full bg-pop-green/15 px-2.5 py-0.5 text-xs font-bold text-pop-green">No ar</span>
                ) : (
                  <span className="rounded-full bg-ink-700 px-2.5 py-0.5 text-xs font-bold text-text-muted">Oculto</span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">{a.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => void toggle(a)} className="btn-pop px-3 py-1.5 text-xs ring-1 ring-ink-700 hover:ring-pop-cyan">
                {a.isActive ? 'Ocultar' : 'Publicar'}
              </button>
              <button onClick={() => void remove(a)} className="btn-pop px-3 py-1.5 text-xs text-pop-orange ring-1 ring-ink-700 hover:ring-pop-orange">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
