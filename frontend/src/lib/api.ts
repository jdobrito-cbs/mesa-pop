const API_URL = import.meta.env.VITE_API_URL || ''

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
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

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  })
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
