const API_URL = import.meta.env.VITE_API_URL || ''

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, string[]>,
  ) {
    super(message)
  }
}

async function request(path: string, opts: { method?: string; body?: unknown }) {
  return fetch(API_URL + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  })
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res = await request(path, opts)

  // Access token expira em ~15min: num 401 fora do /api/auth, tenta
  // renovar a sessão via cookie de refresh e repete a chamada uma vez.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refresh = await request('/api/auth/refresh', { method: 'POST' })
    if (refresh.ok) {
      const data = await refresh.json().catch(() => null)
      if (data?.accessToken) setAccessToken(data.accessToken)
      res = await request(path, opts)
    }
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiRequestError(
      data?.message ?? 'Algo deu errado. Tente de novo.',
      res.status,
      data?.error ?? 'UNKNOWN',
      data?.details,
    )
  }
  return data as T
}
