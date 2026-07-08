import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupSchema, type SetupInput } from '@mesapop/shared'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Chip } from '../components/Logo'

type FieldErrors = Partial<Record<keyof SetupInput, string>>

/**
 * Configuração inicial — primeira vez que a plataforma sobe, ainda sem
 * nenhum admin. Depois que o admin é criado esta tela NÃO funciona mais:
 * ao abrir, confere com o servidor e, se já houver admin, sai na hora
 * (e o backend também recusa a criação de um segundo admin).
 */
export default function Setup() {
  const { setupAdmin } = useAuth()
  const navigate = useNavigate()
  const [checando, setChecando] = useState(true)

  useEffect(() => {
    api<{ needsSetup: boolean }>('/api/setup/status')
      .then((s) => {
        if (!s.needsSetup) navigate('/entrar', { replace: true })
        else setChecando(false)
      })
      .catch(() => setChecando(false))
  }, [navigate])
  const [form, setForm] = useState<SetupInput>({
    email: '',
    username: '',
    name: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [topError, setTopError] = useState('')
  const [sending, setSending] = useState(false)

  function set<K extends keyof SetupInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTopError('')
    const parsed = setupSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SetupInput
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSending(true)
    try {
      await setupAdmin(form)
      navigate('/admin')
    } catch (err) {
      setTopError(err instanceof ApiRequestError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  const fields = [
    { key: 'name' as const, label: 'Seu nome', type: 'text', placeholder: 'Nome do administrador', autoComplete: 'name' },
    { key: 'username' as const, label: 'Nome de usuário', type: 'text', placeholder: 'ex.: admin', autoComplete: 'username' },
    { key: 'email' as const, label: 'E-mail', type: 'email', placeholder: 'voce@seudominio.com', autoComplete: 'email' },
    { key: 'password' as const, label: 'Senha', type: 'password', placeholder: 'Mínimo 8, com maiúscula, minúscula e número', autoComplete: 'new-password' },
    { key: 'passwordConfirm' as const, label: 'Confirmar senha', type: 'password', placeholder: 'A mesma senha de novo', autoComplete: 'new-password' },
  ]

  if (checando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-label="Carregando">
        <div className="animate-float">
          <Chip size={64} spin />
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="flex flex-col items-center gap-3">
        <Chip size={56} />
        <span className="rounded-full bg-pop-yellow/15 px-3 py-1 text-xs font-extrabold tracking-widest text-pop-yellow uppercase">
          configuração inicial
        </span>
      </div>
      <h1 className="mt-4 text-center text-3xl font-extrabold">Bem-vindo ao Mesa Pop!</h1>
      <p className="mt-2 text-center text-text-muted">
        Antes de começar, crie a conta de <strong className="text-text">administrador</strong> da
        sua plataforma. É só desta vez.
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
        <button
          type="submit"
          disabled={sending}
          className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3.5 text-white shadow-lg shadow-pop-purple/25 disabled:opacity-60"
        >
          {sending ? 'Criando…' : 'Criar administrador e entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-text-muted">
        Esta tela só aparece enquanto não houver um administrador. Depois, o acesso é em /admin.
      </p>
    </main>
  )
}
