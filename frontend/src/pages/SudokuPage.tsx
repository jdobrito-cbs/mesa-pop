import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  gerarSudoku,
  SUDOKU_BASE_PONTOS,
  type SudokuDificuldade,
  type SudokuPuzzle,
} from '@mesapop/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'

/**
 * Sudoku — puzzle gerado por seed com solução única. Feedback imediato:
 * número errado não entra (custa pontos), lápis para anotações, dígitos
 * esgotados somem do teclado. Pontos validados no servidor.
 */

const DIFS: Array<{ id: SudokuDificuldade; nome: string; icone: string; desc: string }> = [
  { id: 'facil', nome: 'Fácil', icone: '🌤️', desc: '40 pistas — bom para aquecer.' },
  { id: 'medio', nome: 'Médio', icone: '⛅', desc: '32 pistas — o clássico do dia a dia.' },
  { id: 'dificil', nome: 'Difícil', icone: '⛈️', desc: '26 pistas — só lógica salva.' },
]

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

export default function SudokuPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null)
  const [grade, setGrade] = useState<number[]>([])
  const [notas, setNotas] = useState<Record<number, number[]>>({})
  const [sel, setSel] = useState(-1)
  const [lapis, setLapis] = useState(false)
  const [erros, setErros] = useState(0)
  const [tremendo, setTremendo] = useState(-1)
  const [segundos, setSegundos] = useState(0)
  const [fim, setFim] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const matchRef = useRef<string | null>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>('/api/leaderboards/sudoku')

  const comeca = useCallback(
    (dif: SudokuDificuldade) => {
      const p = gerarSudoku(`${Date.now()}-${Math.random()}`, dif)
      setPuzzle(p)
      setGrade([...p.puzzle])
      setNotas({})
      setSel(-1)
      setErros(0)
      setSegundos(0)
      setFim(null)
      startRef.current = Date.now()
      matchRef.current = null
      if (!isGuest) {
        void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: 'sudoku' } })
          .then((r) => (matchRef.current = r.matchId))
          .catch(() => {})
      }
    },
    [isGuest],
  )

  // hook de dev para a demo automatizada (fora do build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__sudoku = { puzzle, grade }
    }
  }, [puzzle, grade])

  useEffect(() => {
    if (!puzzle || fim) return
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [puzzle, fim])

  function digita(d: number) {
    if (!puzzle || fim || sel < 0 || puzzle.puzzle[sel] !== 0 || grade[sel] !== 0) return
    if (lapis) {
      setNotas((old) => {
        const atual = old[sel] ?? []
        return { ...old, [sel]: atual.includes(d) ? atual.filter((n) => n !== d) : [...atual, d].sort() }
      })
      return
    }
    if (puzzle.solucao[sel] !== d) {
      setErros((e) => e + 1)
      setTremendo(sel)
      setTimeout(() => setTremendo(-1), 450)
      return
    }
    const nova = [...grade]
    nova[sel] = d
    setGrade(nova)
    setNotas((old) => ({ ...old, [sel]: [] }))
    if (nova.every((v, i) => v !== 0 || puzzle.puzzle[i] !== 0) && nova.every((v) => v !== 0)) {
      fecha(nova)
    }
  }

  function fecha(final: number[]) {
    if (!puzzle) return
    void final
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    const total = Math.max(SUDOKU_BASE_PONTOS[puzzle.dificuldade] - secs * 2 - erros * 30, 100)
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

  const contagem = new Map<number, number>()
  for (const v of grade) if (v) contagem.set(v, (contagem.get(v) ?? 0) + 1)

  if (!puzzle) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold"><span aria-hidden="true">🔢</span> Sudoku</h1>
        <p className="mt-1 text-text-muted">Todo puzzle nasce com solução ÚNICA — escolha o clima de hoje:</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {DIFS.map((d) => (
            <button
              key={d.id}
              onClick={() => comeca(d.id)}
              className="card p-5 text-left transition hover:-translate-y-1 hover:ring-pop-cyan/60"
            >
              <p className="text-3xl" aria-hidden="true">{d.icone}</p>
              <p className="mt-2 font-display text-lg font-bold">{d.nome}</p>
              <p className="mt-1 text-sm text-text-muted">{d.desc}</p>
            </button>
          ))}
        </div>
        <AdSlot className="mt-8" />
      </main>
    )
  }

  const selLinha = Math.floor(sel / 9)
  const selCol = sel % 9
  const selBloco = sel >= 0 ? Math.floor(selLinha / 3) * 3 + Math.floor(selCol / 3) : -1

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🔢</span> Sudoku · {DIFS.find((d) => d.id === puzzle.dificuldade)?.nome}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setPuzzle(null)} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            Trocar nível
          </button>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative">
          <div className="mb-3 flex items-center justify-center gap-4 text-sm font-bold">
            <span>⏱️ <span className="tabular-nums">{segundos}s</span></span>
            <span>❌ {erros}</span>
          </div>

          {/* grade */}
          <div className="mx-auto grid max-w-md grid-cols-9 overflow-hidden rounded-2xl ring-2 ring-ink-700">
            {grade.map((v, i) => {
              const r = Math.floor(i / 9)
              const c = i % 9
              const fixa = puzzle.puzzle[i] !== 0
              const bloco = Math.floor(r / 3) * 3 + Math.floor(c / 3)
              const parente = sel >= 0 && (r === selLinha || c === selCol || bloco === selBloco)
              const mesmoDigito = sel >= 0 && grade[sel] !== 0 && v === grade[sel]
              return (
                <button
                  key={i}
                  aria-label={`Casa ${r + 1},${c + 1}`}
                  onClick={() => setSel(i)}
                  className={`flex aspect-square items-center justify-center text-lg font-bold transition-colors sm:text-xl ${
                    c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-ink-600' : 'border-r border-r-ink-800'
                  } ${r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-ink-600' : 'border-b border-b-ink-800'} ${
                    i === sel
                      ? 'bg-pop-purple/40'
                      : mesmoDigito
                        ? 'bg-pop-cyan/25'
                        : parente
                          ? 'bg-ink-800'
                          : 'bg-ink-900'
                  } ${tremendo === i ? 'animate-pulse bg-pop-magenta/40' : ''} ${
                    fixa ? 'text-cream' : 'text-pop-cyan'
                  }`}
                >
                  {v !== 0 ? (
                    v
                  ) : (notas[i]?.length ?? 0) > 0 ? (
                    <span className="grid grid-cols-3 gap-px p-0.5 text-[8px] leading-none text-text-muted sm:text-[9px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <span key={n} className="w-2 text-center">{notas[i]!.includes(n) ? n : ''}</span>
                      ))}
                    </span>
                  ) : (
                    ''
                  )}
                </button>
              )
            })}
          </div>

          {/* teclado */}
          <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                aria-label={`Número ${d}`}
                onClick={() => digita(d)}
                disabled={(contagem.get(d) ?? 0) >= 9}
                className="btn-pop size-11 rounded-xl bg-ink-800 font-display text-lg font-extrabold ring-1 ring-ink-700 hover:ring-pop-cyan disabled:opacity-25 sm:size-12"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setLapis(!lapis)}
              aria-pressed={lapis}
              className={`btn-pop h-11 rounded-xl px-3 text-sm font-bold ring-1 sm:h-12 ${lapis ? 'bg-pop-yellow/20 ring-pop-yellow' : 'bg-ink-800 ring-ink-700'}`}
            >
              ✏️ lápis
            </button>
            <button
              onClick={() => sel >= 0 && setNotas((old) => ({ ...old, [sel]: [] }))}
              className="btn-pop h-11 rounded-xl bg-ink-800 px-3 text-sm font-bold ring-1 ring-ink-700 hover:ring-pop-magenta sm:h-12"
            >
              🧽 apagar
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-text-muted">
            {lapis ? 'Modo lápis: anote candidatos na casa selecionada.' : 'Número errado não entra — mas custa 30 pontos!'}
          </p>

          {fim && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
              <p className="text-5xl" aria-hidden="true">🔢</p>
              <p className="font-display text-3xl font-extrabold text-pop-green">Sudoku fechado!</p>
              <p className="font-display text-2xl font-extrabold text-pop-yellow">{fim.points} pts</p>
              {fim.rank && <p className="text-sm text-text-muted">posição {fim.rank}º no ranking</p>}
              {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
              <button onClick={() => setPuzzle(null)} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                Jogar outro
              </button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!board?.rows.length && <p className="text-sm text-text-muted">Feche um sudoku e abra o placar!</p>}
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
    </main>
  )
}
