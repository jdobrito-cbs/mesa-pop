import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CACA_TAM, gerarCacaPalavras, type CacaPuzzle } from '@mesapop/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'

/**
 * Caça-palavras — sopa 12×12 por tema, gerada por seed. Arraste o dedo
 * ou o mouse em linha reta (8 direções); vale de trás para frente.
 * +30 por palavra + bônus de velocidade ao achar todas.
 */

const CORES = ['#9D5CFF', '#33E0D6', '#FFC53D', '#F252C1', '#55E07F', '#FF8244']

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

/** células em linha reta entre a e b (ou null se não alinhar) */
function linhaReta(a: [number, number], b: [number, number]): Array<[number, number]> | null {
  const dr = Math.sign(b[0] - a[0])
  const dc = Math.sign(b[1] - a[1])
  const passos = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
  if (dr !== 0 && dc !== 0 && Math.abs(b[0] - a[0]) !== Math.abs(b[1] - a[1])) return null
  const cells: Array<[number, number]> = []
  for (let k = 0; k <= passos; k++) cells.push([a[0] + dr * k, a[1] + dc * k])
  return cells
}

export default function CacaPalavrasPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const [puzzle, setPuzzle] = useState<CacaPuzzle | null>(null)
  const [achadas, setAchadas] = useState<Record<string, number>>({}) // palavra → índice da cor
  const [marcadas, setMarcadas] = useState<Record<string, number>>({}) // "r-c" → índice da cor
  const [arrasto, setArrasto] = useState<{ inicio: [number, number]; fim: [number, number] } | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [fim, setFim] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const matchRef = useRef<string | null>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>('/api/leaderboards/caca-palavras')

  const comeca = useCallback(() => {
    setPuzzle(gerarCacaPalavras(`${Date.now()}-${Math.random()}`))
    setAchadas({})
    setMarcadas({})
    setArrasto(null)
    setSegundos(0)
    setFim(null)
    startRef.current = Date.now()
    matchRef.current = null
    if (!isGuest) {
      void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: 'caca-palavras' } })
        .then((r) => (matchRef.current = r.matchId))
        .catch(() => {})
    }
  }, [isGuest])

  useEffect(() => {
    comeca()
  }, [comeca])

  // hook de dev para a demo automatizada (fora do build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__caca = puzzle
    }
  }, [puzzle])

  useEffect(() => {
    if (!puzzle || fim) return
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [puzzle, fim])

  const selecionadas = arrasto ? (linhaReta(arrasto.inicio, arrasto.fim) ?? [arrasto.inicio]) : []
  const selSet = new Set(selecionadas.map(([r, c]) => `${r}-${c}`))

  function solta() {
    if (!puzzle || !arrasto) return
    const cells = linhaReta(arrasto.inicio, arrasto.fim)
    setArrasto(null)
    if (!cells) return
    const texto = cells.map(([r, c]) => puzzle.grid[r]![c]).join('')
    const invertido = [...texto].reverse().join('')
    const alvo = puzzle.palavras.find(
      (p) => !(p.palavra in achadas) && (p.palavra === texto || p.palavra === invertido),
    )
    if (!alvo) return
    const cor = Object.keys(achadas).length % CORES.length
    const novasAchadas = { ...achadas, [alvo.palavra]: cor }
    setAchadas(novasAchadas)
    setMarcadas((old) => {
      const novo = { ...old }
      for (const [r, c] of cells) novo[`${r}-${c}`] = cor
      return novo
    })
    if (Object.keys(novasAchadas).length === puzzle.palavras.length) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      const total = puzzle.palavras.length * 30 + Math.max(600 - secs * 2, 100)
      setFim({ points: total })
      const matchId = matchRef.current
      if (matchId) {
        void api<{ points: number; best: number; rank: number }>('/api/solo/finish', {
          body: { matchId, points: total },
        })
          .then((r) => {
            setFim({ points: r.points, rank: r.rank, best: r.best })
            void reload()
          })
          .catch(() => {})
      }
    }
  }

  if (!puzzle) return null

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🔍</span> Caça-palavras · <span className="text-pop-cyan">{puzzle.tema}</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={comeca} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            Nova sopa
          </button>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Arraste em linha reta — vale nas 8 direções e de trás para frente. ⏱️ <span className="tabular-nums font-bold">{segundos}s</span>
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative select-none">
          <div
            className="mx-auto grid max-w-lg touch-none gap-0.5 rounded-2xl bg-ink-950/60 p-2 ring-1 ring-ink-700"
            style={{ gridTemplateColumns: `repeat(${CACA_TAM}, minmax(0, 1fr))` }}
            onPointerUp={solta}
            onPointerLeave={() => arrasto && solta()}
          >
            {puzzle.grid.map((linha, r) =>
              linha.map((letra, c) => {
                const key = `${r}-${c}`
                const corAchada = marcadas[key]
                const naSelecao = selSet.has(key)
                return (
                  <button
                    key={key}
                    data-rc={key}
                    onPointerDown={(e) => {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                      setArrasto({ inicio: [r, c], fim: [r, c] })
                    }}
                    onPointerEnter={() => arrasto && setArrasto({ ...arrasto, fim: [r, c] })}
                    className="flex aspect-square items-center justify-center rounded-md font-display text-sm font-extrabold transition-colors sm:text-base"
                    style={{
                      background: naSelecao
                        ? 'rgb(157 92 255 / .55)'
                        : corAchada !== undefined
                          ? `${CORES[corAchada]}44`
                          : 'transparent',
                      color: corAchada !== undefined && !naSelecao ? CORES[corAchada] : undefined,
                    }}
                  >
                    {letra}
                  </button>
                )
              }),
            )}
          </div>

          {fim && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
              <p className="text-5xl" aria-hidden="true">🔍</p>
              <p className="font-display text-3xl font-extrabold text-pop-green">Sopa limpa!</p>
              <p className="font-display text-2xl font-extrabold text-pop-yellow">{fim.points} pts</p>
              {fim.rank && <p className="text-sm text-text-muted">posição {fim.rank}º no ranking</p>}
              {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
              <button onClick={comeca} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                Outra sopa
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <p className="font-display text-sm font-bold">
              📜 Palavras · {Object.keys(achadas).length}/{puzzle.palavras.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {puzzle.palavras.map(({ palavra }) => {
                const cor = achadas[palavra]
                return (
                  <span
                    key={palavra}
                    className={`text-sm font-bold ${cor === undefined ? '' : 'line-through opacity-70'}`}
                    style={{ color: cor === undefined ? undefined : CORES[cor] }}
                  >
                    {palavra}
                  </span>
                )
              })}
            </div>
          </div>
          <div className="card p-4">
            <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {!board?.rows.length && <p className="text-sm text-text-muted">Limpe uma sopa e abra o placar!</p>}
              {board?.rows.map((row) => (
                <div key={row.userId} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                  <span className={`w-7 font-display font-extrabold ${row.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{row.rank}º</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{row.displayName}</span>
                  <span className="font-bold text-pop-cyan tabular-nums">{row.points}</span>
                </div>
              ))}
            </div>
            <AdSlot className="mt-4" />
          </div>
        </div>
      </div>
    </main>
  )
}
