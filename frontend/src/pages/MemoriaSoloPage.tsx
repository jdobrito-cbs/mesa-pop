import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MEMORIA_COLS, MEMORIA_ROWS, type MemoriaCarta } from '@mesapop/shared'
import { MemoriaGrid } from '../components/MemoriaBoard'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'
import FullscreenButton from '../components/FullscreenButton'

/**
 * Memória SOLO — contra o relógio: +40 por par; fechar o tabuleiro rende
 * bônus de velocidade e precisão. Pontos validados no servidor
 * (start/finish + teto de plausibilidade); convidado treina sem pontuar.
 */

const TOTAL = MEMORIA_COLS * MEMORIA_ROWS

interface Jogo {
  valores: number[]
  presas: boolean[]
  viradas: number[]
  pares: number
  erros: number
}

function novoJogo(): Jogo {
  const valores: number[] = []
  for (let v = 0; v < TOTAL / 2; v++) valores.push(v, v)
  for (let i = valores.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[valores[i], valores[j]] = [valores[j]!, valores[i]!]
  }
  return { valores, presas: Array.from({ length: TOTAL }, () => false), viradas: [], pares: 0, erros: 0 }
}

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

export default function MemoriaSoloPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const [g, setG] = useState<Jogo>(novoJogo)
  const [segundos, setSegundos] = useState(0)
  const [fim, setFim] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const matchRef = useRef<string | null>(null)
  const escondeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fsRef = useRef<HTMLElement>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>('/api/leaderboards/memoria')

  const abrirPartida = useCallback(() => {
    startRef.current = Date.now()
    matchRef.current = null
    if (!isGuest) {
      void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: 'memoria' } })
        .then((r) => (matchRef.current = r.matchId))
        .catch(() => {})
    }
  }, [isGuest])

  useEffect(() => {
    abrirPartida()
  }, [abrirPartida])

  useEffect(() => {
    if (fim) return
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [fim])

  function reiniciar() {
    if (escondeRef.current) clearTimeout(escondeRef.current)
    setG(novoJogo())
    setFim(null)
    setSegundos(0)
    abrirPartida()
  }

  function virar(i: number) {
    if (fim) return
    setG((old) => {
      if (old.presas[i] || old.viradas.includes(i) || old.viradas.length >= 2) return old
      const viradas = [...old.viradas, i]
      if (viradas.length < 2) return { ...old, viradas }
      const [a, b] = viradas as [number, number]
      if (old.valores[a] === old.valores[b]) {
        const presas = [...old.presas]
        presas[a] = true
        presas[b] = true
        const pares = old.pares + 1
        const next = { ...old, presas, viradas: [], pares }
        if (pares === TOTAL / 2) fecha(next)
        return next
      }
      // erro: mantém viradas por 900ms e esconde
      escondeRef.current = setTimeout(
        () => setG((cur) => ({ ...cur, viradas: [], erros: cur.erros + 1 })),
        900,
      )
      return { ...old, viradas }
    })
  }

  function fecha(estadoFinal: Jogo) {
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    const bonus = Math.max(900 - secs * 5 - estadoFinal.erros * 8, 100)
    const total = (TOTAL / 2) * 40 + bonus
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

  const cartas: MemoriaCarta[] = g.valores.map((v, i) => {
    if (g.presas[i]) return { estado: 'presa', valor: v, dono: 0 }
    if (g.viradas.includes(i)) return { estado: 'virada', valor: v }
    return { estado: 'oculta' }
  })

  return (
    <main ref={fsRef} className="game-fs mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold"><span aria-hidden="true">🧠</span> Memória · treino solo</h1>
        <div className="flex gap-2">
          <FullscreenButton targetRef={fsRef} />
          <button onClick={reiniciar} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            Novo jogo
          </button>
          <button onClick={() => navigate('/jogos/memoria')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Jogar com amigos
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Ache os {TOTAL / 2} pares no menor tempo — cada erro custa bônus. {MEMORIA_ROWS}×{MEMORIA_COLS}, valendo ranking!
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative rounded-card bg-ink-900 p-4 ring-1 ring-ink-700">
          <div className="mb-3 flex items-center justify-center gap-4 text-sm font-bold">
            <span>⏱️ <span className="tabular-nums">{segundos}s</span></span>
            <span>✅ {g.pares}/{TOTAL / 2}</span>
            <span>❌ {g.erros}</span>
          </div>
          <MemoriaGrid cartas={cartas} onFlip={virar} disabled={!!fim || g.viradas.length >= 2} />

          {fim && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
              <p className="text-5xl" aria-hidden="true">🧠</p>
              <p className="font-display text-3xl font-extrabold text-pop-green">Memória de elefante!</p>
              <p className="font-display text-2xl font-extrabold text-pop-yellow">{fim.points} pts</p>
              {fim.rank && <p className="text-sm text-text-muted">posição {fim.rank}º no ranking</p>}
              {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
              <button onClick={reiniciar} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                Jogar de novo
              </button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!board?.rows.length && <p className="text-sm text-text-muted">Feche o tabuleiro e abra o placar!</p>}
            {board?.rows.map((r) => (
              <div key={r.userId} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                <span className={`w-7 font-display font-extrabold ${r.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{r.rank}º</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.displayName}</span>
                <span className="font-bold text-pop-cyan tabular-nums">{r.points}</span>
              </div>
            ))}
          </div>
          <AdSlot className="mt-4" />
        </div>
      </div>
    </main>
  )
}
