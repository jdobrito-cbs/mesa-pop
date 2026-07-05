export type Role = 'USER' | 'ADMIN'

/** Dados públicos de um usuário — nunca inclui hash de senha. */
export interface UserPublic {
  id: string
  email: string
  name: string
  displayName: string
  phone: string
  role: Role
  avatarUrl: string | null
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
