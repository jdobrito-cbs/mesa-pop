import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/** Fetch com estados de carregamento/erro e reload — para páginas do admin/lobby. */
export function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // `silent`: atualiza os dados SEM voltar ao estado de carregamento — para
  // polling em tempo real que não deve fazer a tela piscar "…".
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        setData(await api<T>(path))
        setError('')
      } catch (err) {
        if (!opts?.silent) setError(err instanceof Error ? err.message : 'Erro ao carregar')
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [path],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}
