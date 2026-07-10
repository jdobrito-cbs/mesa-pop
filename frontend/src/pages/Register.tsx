import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AVATARES_NORMAIS, registerSchema, type RegisterInput } from '@mesapop/shared'
import AvatarSvg from '../components/AvatarSvg'
import { ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'

type FieldErrors = Partial<Record<keyof RegisterInput, string>>

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterInput>({
    email: '',
    username: '',
    name: '',
    phone: '',
    password: '',
    passwordConfirm: '',
    avatar: AVATARES_NORMAIS[Math.floor(Math.random() * AVATARES_NORMAIS.length)],
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [topError, setTopError] = useState('')
  const [sending, setSending] = useState(false)

  function set<K extends keyof RegisterInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTopError('')

    const parsed = registerSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RegisterInput
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSending(true)
    try {
      await register(form)
      navigate('/mesa')
    } catch (err) {
      setTopError(err instanceof ApiRequestError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  const fields = [
    { key: 'name' as const, label: 'Nome', type: 'text', placeholder: 'Seu nome completo', autoComplete: 'name' },
    { key: 'username' as const, label: 'Nome de usuário', type: 'text', placeholder: 'único na mesa — aparece nos rankings', autoComplete: 'username' },
    { key: 'email' as const, label: 'E-mail', type: 'email', placeholder: 'voce@exemplo.com', autoComplete: 'email' },
    { key: 'phone' as const, label: 'Telefone', type: 'tel', placeholder: '(11) 98765-4321', autoComplete: 'tel' },
    { key: 'password' as const, label: 'Senha', type: 'password', placeholder: 'Mínimo 8, com maiúscula, minúscula e número', autoComplete: 'new-password' },
    { key: 'passwordConfirm' as const, label: 'Confirmar senha', type: 'password', placeholder: 'A mesma senha de novo', autoComplete: 'new-password' },
  ]

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14">
      <h1 className="text-center text-4xl font-extrabold">Puxe uma cadeira</h1>
      <p className="mt-2 text-center text-text-muted">
        Crie sua conta e entre na mesa.
      </p>

      <form onSubmit={handleSubmit} className="card mt-8 flex flex-col gap-4 p-6" noValidate>
        {topError && (
          <p role="alert" className="rounded-field bg-pop-magenta/15 px-4 py-3 text-sm font-semibold text-pop-magenta">
            {topError}
          </p>
        )}
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">{f.label}</span>
            <input
              className="field"
              type={f.type}
              value={form[f.key]}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              onChange={(e) => set(f.key, e.target.value)}
              aria-invalid={!!errors[f.key]}
            />
            {errors[f.key] && (
              <span className="text-sm font-semibold text-pop-orange">{errors[f.key]}</span>
            )}
          </label>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Escolha seu avatar</span>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {AVATARES_NORMAIS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, avatar: id }))}
                aria-pressed={form.avatar === id}
                className={`rounded-full ring-2 transition ${form.avatar === id ? 'ring-pop-cyan' : 'ring-transparent hover:ring-pop-purple/60'}`}
              >
                <AvatarSvg id={id} size={44} />
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3.5 text-white shadow-lg shadow-pop-purple/25 disabled:opacity-60"
        >
          {sending ? 'Criando…' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-bold text-pop-cyan hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  )
}
