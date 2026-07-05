export type Role = 'USER' | 'ADMIN'

/** Dados públicos de um usuário — nunca inclui hash de senha. */
export interface UserPublic {
  id: string
  email: string
  /** nome de usuário único (contas registradas; null para convidados) */
  username: string | null
  name: string
  displayName: string
  phone: string
  role: Role
  avatarUrl: string | null
  /** conta convidada ("jogar sem conta"): sem chat, saves ou ranking */
  isGuest: boolean
  createdAt: string
}

export interface AuthResponse {
  user: UserPublic
  accessToken: string
}

export interface ApiError {
  error: string
  message: string
  details?: unknown
}
