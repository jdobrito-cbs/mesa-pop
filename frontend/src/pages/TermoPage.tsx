import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import AdSlot from '../components/AdSlot'
import FullscreenButton from '../components/FullscreenButton'

/**
 * Palavra do Dia — a MESMA palavra de 5 letras para todo mundo, trocada
 * a cada dia. A palavra vive no SERVIDOR: o cliente só recebe as cores.
 * Verde = letra no lugar; amarelo = existe em outra posição.
 */

interface Attempt {
  palpite: string
  feedback: string // 'g' | 'y' | 'b' ×5
}

interface Hoje {
  date: string
  attempts: Attempt[]
  done: boolean
  won: boolean
  points: number
  maxAttempts: number
}

interface RankRow {
  rank: number
  displayName: string
  points: number
  attempts: number
}

const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

const cellColor = (f: string) =>
  f === 'g'
    ? 'bg-pop-green text-ink-950'
    : f === 'y'
      ? 'bg-pop-yellow text-ink-950'
      : 'bg-ink-700 text-cream/70'

export default function TermoPage() {
  const navigate = useNavigate()
  const fsRef = useRef<HTMLElement>(null)
  const { user } = useAuth()
  const [hoje, setHoje] = useState<Hoje | null>(null)
  const [atual, setAtual] = useState('')
  const [aviso, setAviso] = useState('')
  const [revelada, setRevelada] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const { data: ranking, reload: reloadRanking } = useFetch<{ rows: RankRow[] }>('/api/termo/ranking')

  useEffect(() => {
    void api<Hoje>('/api/termo/hoje').then(setHoje).catch(() => {})
  }, [])

  const mostraAviso = (msg: string) => {
    setAviso(msg)
    setShake(true)
    setTimeout(() => {
      setAviso('')
      setShake(false)
    }, 1800)
  }

  const enviar = useCallback(async () => {
    if (!hoje || hoje.done) return
    if (atual.length !== 5) {
      mostraAviso('Digite 5 letras')
      return
    }
    try {
      const res = await api<{ feedback: string; done: boolean; won: boolean; points: number; palavra: string | null }>(
        '/api/termo/palpite',
        { body: { palavra: atual } },
      )
      setHoje((h) =>
        h
          ? {
              ...h,
              attempts: [...h.attempts, { palpite: atual.toLowerCase(), feedback: res.feedback }],
              done: res.done,
              won: res.won,
              points: res.points,
            }
          : h,
      )
      if (res.palavra) setRevelada(res.palavra)
      setAtual('')
      if (res.done) void reloadRanking()
    } catch (err) {
      mostraAviso(err instanceof ApiRequestError ? err.message : 'Não deu — tente de novo')
    }
  }, [hoje, atual, reloadRanking])

  // teclado físico
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hoje || hoje.done) return
      if (e.key === 'Enter') void enviar()
      else if (e.key === 'Backspace') setAtual((a) => a.slice(0, -1))
      else if (/^[a-zA-Z]$/.test(e.key)) setAtual((a) => (a.length < 5 ? a + e.key.toLowerCase() : a))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hoje, enviar])

  // cor de cada tecla = melhor feedback já visto
  const keyState = new Map<string, string>()
  for (const at of hoje?.attempts ?? []) {
    ;[...at.palpite].forEach((ch, i) => {
      const f = at.feedback[i]!
      const prev = keyState.get(ch)
      if (f === 'g' || (f === 'y' && prev !== 'g') || (!prev && f === 'b')) keyState.set(ch, f)
    })
  }

  const linhas = Array.from({ length: 6 }, (_, i) => {
    const at = hoje?.attempts[i]
    if (at) return { letras: [...at.palpite], feedback: [...at.feedback], atual: false }
    if (i === (hoje?.attempts.length ?? 0) && !hoje?.done) {
      return { letras: [...atual.padEnd(5, ' ')], feedback: null, atual: true }
    }
    return { letras: Array.from({ length: 5 }, () => ' '), feedback: null, atual: false }
  })

  return (
    <main ref={fsRef} className="game-fs mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🔤</span> Palavra do Dia
        </h1>
        <div className="flex gap-2">
          <FullscreenButton targetRef={fsRef} />
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Uma palavra por dia, a mesma para todo mundo. Verde = letra no lugar; amarelo = letra existe em outra casa.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="mx-auto w-full max-w-sm">
          {aviso && (
            <p className="mb-3 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">
              {aviso}
            </p>
          )}

          {/* grade 6×5 */}
          <div className={`flex flex-col gap-1.5 ${shake ? 'animate-pulse' : ''}`} aria-label="Grade de tentativas">
            {linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-5 gap-1.5">
                {l.letras.map((ch, j) => (
                  <div
                    key={j}
                    className={`flex aspect-square items-center justify-center rounded-xl font-display text-3xl font-extrabold uppercase transition ${
                      l.feedback
                        ? cellColor(l.feedback[j]!)
                        : ch !== ' '
                          ? 'bg-ink-800 ring-2 ring-pop-cyan/60'
                          : 'bg-ink-800 ring-1 ring-ink-700'
                    }`}
                  >
                    {ch.trim()}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* fim do dia */}
          {hoje?.done && (
            <div className="card mt-4 p-4 text-center">
              {hoje.won ? (
                <>
                  <p className="text-3xl" aria-hidden="true">🏆</p>
                  <p className="mt-1 font-display text-xl font-extrabold text-pop-green">
                    Acertou em {hoje.attempts.length} tentativa{hoje.attempts.length > 1 ? 's' : ''}!
                  </p>
                  <p className="text-pop-yellow">+{hoje.points} pontos</p>
                </>
              ) : (
                <>
                  <p className="text-3xl" aria-hidden="true">😅</p>
                  <p className="mt-1 font-display text-lg font-extrabold">
                    A palavra era <span className="text-pop-yellow uppercase">{revelada}</span>
                  </p>
                </>
              )}
              <p className="mt-2 text-xs text-text-muted">Amanhã tem palavra nova!</p>
              {user?.isGuest && (
                <p className="mt-2 text-xs text-text-muted">
                  Convidados não entram no ranking do dia —{' '}
                  <a href="/criar-conta" className="font-bold text-pop-cyan hover:underline">crie sua conta</a>.
                </p>
              )}
            </div>
          )}

          {/* teclado virtual */}
          {!hoje?.done && (
            <div className="mt-5 flex flex-col items-center gap-1.5">
              {TECLADO.map((row, i) => (
                <div key={row} className="flex gap-1.5">
                  {i === 2 && (
                    <button
                      onClick={() => void enviar()}
                      className="btn-pop rounded-lg bg-pop-purple px-3 text-xs font-extrabold text-white"
                    >
                      ENTER
                    </button>
                  )}
                  {[...row].map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setAtual((a) => (a.length < 5 ? a + ch : a))}
                      className={`flex h-11 w-8 items-center justify-center rounded-lg font-display text-sm font-extrabold uppercase transition active:scale-90 sm:w-9 ${
                        keyState.has(ch) ? cellColor(keyState.get(ch)!) : 'bg-ink-800 ring-1 ring-ink-700'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                  {i === 2 && (
                    <button
                      onClick={() => setAtual((a) => a.slice(0, -1))}
                      className="btn-pop rounded-lg bg-ink-800 px-3 text-sm ring-1 ring-ink-700"
                      aria-label="Apagar"
                    >
                      ⌫
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ranking do dia */}
        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking de hoje</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!ranking?.rows.length && (
              <p className="text-sm text-text-muted">Ninguém acertou ainda — seja quem abre o placar!</p>
            )}
            {ranking?.rows.map((r) => (
              <div key={r.rank} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                <span className={`w-7 font-display font-extrabold ${r.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>
                  {r.rank}º
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.displayName}</span>
                <span className="text-xs text-text-muted">{r.attempts} tent.</span>
                <span className="font-bold text-pop-cyan tabular-nums">{r.points}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">
            A palavra fica no servidor — impossível espiar. 😉
          </p>
          <AdSlot className="mt-4" />
        </div>
      </div>
    </main>
  )
}
