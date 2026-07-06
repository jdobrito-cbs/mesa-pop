import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema } from '@mesapop/shared'
import { ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login, guest } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // link compartilhado (ex.: /sala/ABC123) → volta para lá depois de entrar
  const from = (location.state as { from?: string } | null)?.from ?? '/mesa'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os campos')
      return
    }
    setError('')
    setSending(true)
    try {
      await login({ email, password })
      navigate(from)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  async function handleGuest(e: FormEvent) {
    e.preventDefault()
    if (guestName.trim().length < 2) {
      setError('Diga como quer ser chamado (2+ letras)')
      return
    }
    setError('')
    setSending(true)
    try {
      await guest(guestName.trim())
      navigate(from)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14">
      <h1 className="text-center text-4xl font-extrabold">Bem-vindo à mesa</h1>
      <p className="mt-2 text-center text-text-muted">Escolha um nome e já comece a jogar.</p>

      {error && (
        <p role="alert" className="mt-6 rounded-field bg-pop-magenta/15 px-4 py-3 text-sm font-semibold text-pop-magenta">
          {error}
        </p>
      )}

      {/* jogar sem conta PRIMEIRO: só precisa de um nome */}
      <form onSubmit={handleGuest} className="card mt-6 flex flex-col gap-3 p-5" noValidate>
        <p className="text-center font-display text-lg font-bold">
          🎟️ Jogue sem conta
        </p>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            type="text"
            value={guestName}
            placeholder="Como quer ser chamado?"
            maxLength={30}
            onChange={(e) => setGuestName(e.target.value)}
            aria-label="Nome de convidado"
          />
          <button
            type="submit"
            disabled={sending}
            className="btn-pop bg-gradient-to-br from-pop-cyan to-pop-green px-5 py-2.5 text-sm font-extrabold text-ink-950 disabled:opacity-60"
          >
            Jogar!
          </button>
        </div>
        <p className="text-center text-xs text-text-muted">
          Convidados jogam à vontade — mas chat, fazenda e ranking pedem conta.
        </p>
      </form>

      <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-4 p-6" noValidate>
        <p className="text-center font-display text-lg font-bold">
          💾 Salve seu progresso com um login grátis
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">E-mail</span>
          <input
            className="field"
            type="email"
            value={email}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Senha</span>
          <input
            className="field"
            type="password"
            value={password}
            placeholder="Sua senha"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={sending}
          className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3.5 text-white shadow-lg shadow-pop-purple/25 disabled:opacity-60"
        >
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Primeira vez por aqui?{' '}
        <Link to="/criar-conta" className="font-bold text-pop-cyan hover:underline">
          Criar conta
        </Link>
      </p>
    </main>
  )
}
