import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'
import FullscreenButton from '../components/FullscreenButton'
import AvatarSvg from '../components/AvatarSvg'

/**
 * Paciência (Klondike) — clique inteligente: tocar numa carta manda para
 * a fundação quando dá, senão para a melhor coluna. Compra de 1 em 1.
 * +10 por carta na fundação, +5 por carta virada; fechar o baralho
 * rende bônus por velocidade. Pontos validados no servidor.
 */

type Suit = 0 | 1 | 2 | 3 // ♠ ♥ ♦ ♣
interface Carta {
  s: Suit
  r: number // 1..13
  up: boolean
}

const SUIT = ['♠', '♥', '♦', '♣']
const RED = (s: Suit) => s === 1 || s === 2
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

interface Estado {
  cols: Carta[][]
  stock: Carta[]
  waste: Carta[]
  found: Carta[][]
  points: number
  moves: number
}

function novoJogo(): Estado {
  const deck: Carta[] = []
  for (let s = 0 as Suit; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s: s as Suit, r, up: false })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  const cols: Carta[][] = []
  let k = 0
  for (let c = 0; c < 7; c++) {
    cols.push(deck.slice(k, k + c + 1).map((card, i) => ({ ...card, up: i === c })))
    k += c + 1
  }
  return { cols, stock: deck.slice(k), waste: [], found: [[], [], [], []], points: 0, moves: 0 }
}

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

export default function PacienciaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const [g, setG] = useState<Estado>(novoJogo)
  const [venceu, setVenceu] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const matchRef = useRef<string | null>(null)
  const fsRef = useRef<HTMLElement>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>('/api/leaderboards/paciencia')

  const abrirPartida = useCallback(() => {
    startRef.current = Date.now()
    matchRef.current = null
    if (!isGuest) {
      void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: 'paciencia' } })
        .then((r) => (matchRef.current = r.matchId))
        .catch(() => {})
    }
  }, [isGuest])

  useEffect(() => {
    abrirPartida()
  }, [abrirPartida])

  function reiniciar() {
    setG(novoJogo())
    setVenceu(null)
    abrirPartida()
  }

  /** tenta fundação; senão a melhor coluna; vira cartas expostas */
  function mexe(next: Estado): Estado {
    for (const col of next.cols) {
      const top = col[col.length - 1]
      if (top && !top.up) {
        top.up = true
        next.points += 5
      }
    }
    return { ...next, cols: next.cols.map((c) => [...c]) }
  }

  function tentaFundacao(next: Estado, carta: Carta): boolean {
    const f = next.found[carta.s]!
    const topo = f[f.length - 1]
    if ((topo?.r ?? 0) + 1 === carta.r) {
      f.push(carta)
      next.points += 10
      return true
    }
    return false
  }

  function podeEmpilhar(sobre: Carta | undefined, carta: Carta): boolean {
    if (!sobre) return carta.r === 13 // coluna vazia só aceita K
    return sobre.up && sobre.r === carta.r + 1 && RED(sobre.s) !== RED(carta.s)
  }

  function clicaWaste() {
    setG((old) => {
      const next = { ...old, waste: [...old.waste], found: old.found.map((f) => [...f]), cols: old.cols.map((c) => [...c]) }
      const carta = next.waste[next.waste.length - 1]
      if (!carta) return old
      if (tentaFundacao(next, carta)) {
        next.waste.pop()
      } else {
        const col = next.cols.find((c) => podeEmpilhar(c[c.length - 1], carta))
        if (!col) return old
        col.push(carta)
        next.waste.pop()
      }
      next.moves++
      return checaVitoria(mexe(next))
    })
  }

  function clicaColuna(ci: number, idx: number) {
    setG((old) => {
      const next = { ...old, waste: [...old.waste], found: old.found.map((f) => [...f]), cols: old.cols.map((c) => [...c]) }
      const col = next.cols[ci]!
      const carta = col[idx]
      if (!carta?.up) return old
      const corrida = col.slice(idx)
      // carta do topo pode subir para a fundação
      if (corrida.length === 1 && tentaFundacao(next, carta)) {
        col.pop()
        next.moves++
        return checaVitoria(mexe(next))
      }
      // move a corrida para outra coluna válida
      const destino = next.cols.find((c, i) => i !== ci && podeEmpilhar(c[c.length - 1], carta))
      if (!destino) return old
      destino.push(...corrida)
      col.splice(idx)
      next.moves++
      return checaVitoria(mexe(next))
    })
  }

  function compra() {
    setG((old) => {
      const next = { ...old, stock: [...old.stock], waste: [...old.waste] }
      if (next.stock.length === 0) {
        if (next.waste.length === 0) return old
        next.stock = next.waste.reverse().map((c) => ({ ...c, up: false }))
        next.waste = []
        return next
      }
      const c = next.stock.pop()!
      next.waste.push({ ...c, up: true })
      return next
    })
  }

  function checaVitoria(next: Estado): Estado {
    if (next.found.reduce((a, f) => a + f.length, 0) === 52 && !venceu) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      const bonus = Math.max(600 - secs * 2, 100)
      const total = next.points + bonus
      setVenceu({ points: total })
      const matchId = matchRef.current
      if (matchId) {
        void api<{ points: number; best: number; rank: number }>('/api/solo/finish', {
          body: { matchId, points: total },
        })
          .then((r) => {
            setVenceu({ points: r.points, rank: r.rank, best: r.best })
            void reload()
          })
          .catch(() => {})
      }
    }
    return next
  }

  const CartaEl = ({ c, onClick, className = '' }: { c: Carta | null; onClick?: () => void; className?: string }) =>
    c ? (
      c.up ? (
        <button
          onClick={onClick}
          disabled={!onClick}
          className={`flex h-16 w-12 flex-col items-center justify-center rounded-lg bg-cream font-display text-sm font-extrabold shadow ring-1 ring-ink-700/30 sm:h-20 sm:w-14 ${
            onClick ? 'cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-pop-cyan' : ''
          } ${className}`}
        >
          <span className={RED(c.s) ? 'text-pop-magenta' : 'text-ink-950'}>{RANK[c.r]}</span>
          <span className={`text-lg ${RED(c.s) ? 'text-pop-magenta' : 'text-ink-950'}`}>{SUIT[c.s]}</span>
        </button>
      ) : (
        <div className={`h-16 w-12 rounded-lg bg-gradient-to-br from-pop-purple to-ink-800 ring-1 ring-ink-700 sm:h-20 sm:w-14 ${className}`} />
      )
    ) : (
      <div className={`h-16 w-12 rounded-lg border-2 border-dashed border-cream/20 sm:h-20 sm:w-14 ${className}`} />
    )

  return (
    <main ref={fsRef} className="game-fs mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold"><span aria-hidden="true">🃑</span> Paciência</h1>
        <div className="flex gap-2">
          <FullscreenButton targetRef={fsRef} />
          <button onClick={reiniciar} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            Novo jogo
          </button>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Toque numa carta: ela sobe para a fundação quando dá, senão vai para a melhor coluna. Toque no monte para comprar.
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative rounded-card bg-gradient-to-br from-[#1E5B38] to-[#14432A] p-4 ring-4 ring-[#0E2E1D]">
          {/* topo: monte, descarte e fundações */}
          <div className="flex items-start justify-between">
            <div className="flex gap-2">
              <button onClick={compra} aria-label="Comprar carta" className="cursor-pointer">
                {g.stock.length ? (
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-pop-purple to-ink-800 font-bold text-cream ring-1 ring-ink-700 sm:h-20 sm:w-14">
                    {g.stock.length}
                  </div>
                ) : (
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-dashed border-cream/30 text-cream/60 sm:h-20 sm:w-14">↻</div>
                )}
              </button>
              <CartaEl c={g.waste[g.waste.length - 1] ?? null} onClick={g.waste.length ? clicaWaste : undefined} />
            </div>
            <div className="flex gap-2">
              {g.found.map((f, i) => (
                <div key={i} className="relative">
                  <CartaEl c={f[f.length - 1] ?? null} />
                  {!f.length && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl text-cream/30">
                      {SUIT[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* colunas */}
          <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
            {g.cols.map((col, ci) => (
              <div key={ci} className="flex min-h-24 flex-col">
                {col.length === 0 && <CartaEl c={null} />}
                {col.map((c, i) => (
                  <div key={`${c.s}${c.r}`} className={i > 0 ? '-mt-10 sm:-mt-12' : ''} style={{ zIndex: i }}>
                    <CartaEl c={c} onClick={c.up ? () => clicaColuna(ci, i) : undefined} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {venceu && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
              <p className="text-5xl" aria-hidden="true">🏆</p>
              <p className="font-display text-3xl font-extrabold text-pop-green">Baralho fechado!</p>
              <p className="font-display text-2xl font-extrabold text-pop-yellow">{venceu.points} pts</p>
              {venceu.rank && <p className="text-sm text-text-muted">posição {venceu.rank}º no ranking</p>}
              {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
              <button onClick={reiniciar} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                Jogar de novo
              </button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
          <p className="mt-2 text-sm text-text-muted">
            Pontos: <strong className="text-text">{g.points}</strong> · jogadas: {g.moves}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!board?.rows.length && <p className="text-sm text-text-muted">Feche o baralho e abra o placar!</p>}
            {board?.rows.map((r) => (
              <div key={r.userId} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                <span className={`w-7 font-display font-extrabold ${r.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{r.rank}º</span>
                <AvatarSvg id={r.displayName} size={20} />
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
