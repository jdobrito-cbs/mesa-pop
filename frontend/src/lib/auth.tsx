import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AuthResponse, LoginInput, RegisterInput, SetupInput, UserPublic } from '@mesapop/shared'
import { api, setAccessToken } from './api'

interface AuthContextValue {
  user: UserPublic | null
  /** true enquanto tenta restaurar a sessão no primeiro load */
  restoring: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  /** configuração inicial: cria o primeiro admin e já entra logado */
  setupAdmin: (input: SetupInput) => Promise<void>
  /** "jogar sem conta": cria sessão de convidado com o nome informado */
  guest: (name: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  const [restoring, setRestoring] = useState(true)

  const applySession = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken)
    setUser(res.user)
  }, [])

  // Restaura a sessão via cookie de refresh (httpOnly)
  useEffect(() => {
    api<AuthResponse>('/api/auth/refresh', { method: 'POST' })
      .then(applySession)
      .catch(() => setAccessToken(null))
      .finally(() => setRestoring(false))
  }, [applySession])

  const login = useCallback(
    async (input: LoginInput) => {
      applySession(await api<AuthResponse>('/api/auth/login', { body: input }))
    },
    [applySession],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      applySession(await api<AuthResponse>('/api/auth/register', { body: input }))
    },
    [applySession],
  )

  const setupAdmin = useCallback(async (input: SetupInput) => {
    // cria o admin e NÃO abre sessão: o usuário é levado ao login.
    await api('/api/setup/admin', { body: input })
  }, [])

  const guest = useCallback(
    async (name: string) => {
      applySession(await api<AuthResponse>('/api/auth/guest', { body: { name } }))
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setAccessToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, restoring, login, register, setupAdmin, guest, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
