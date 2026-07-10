import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gerarCruzadinha, type CruzPalavra, type CruzPuzzle } from '@mesapop/shared'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { makeSoloBackend } from '../lib/soloBackend'
import AdSlot from '../components/AdSlot'
import FullscreenButton from '../components/FullscreenButton'
import AvatarSvg from '../components/AvatarSvg'

/**
 * Cruzadinha estilo Coquetel — toque numa casa, leia a dica e digite
 * (teclado físico ou o A–Z na tela). Letra errada não entra, mas custa
 * pontos; palavra completa risca a dica. Pontos validados no servidor.
 */

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

export default function CruzadinhaPage({ daily }: { daily?: string } = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const backend = useMemo(
    () => makeSoloBackend('cruzadinha', { guest: isGuest, daily }),
    [isGuest, daily],
  )
  const [puzzle, setPuzzle] = useState<CruzPuzzle | null>(null)
  const [certas, setCertas] = useState<Record<string, string>>({}) // "r-c" → letra
  const [ativa, setAtiva] = useState(0) // índice em puzzle.palavras
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const [erros, setErros] = useState(0)
  const [tremendo, setTremendo] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [fim, setFim] = useState<{ points: number; rank?: number; best?: number } | null>(null)
  const startRef = useRef(Date.now())
  const tokenRef = useRef<string>('')
  const fsRef = useRef<HTMLElement>(null)
  const { data: board, reload } = useFetch<{ rows: LeaderRow[] }>(backend.leaderboard)

  const comeca = useCallback(() => {
    const p = gerarCruzadinha(backend.nextSeed())
    setPuzzle(p)
    setCertas({})
    setAtiva(0)
    setCursor(p.palavras[0]!.cells[0]!)
    setErros(0)
    setSegundos(0)
    setFim(null)
    startRef.current = Date.now()
    tokenRef.current = ''
    void backend.start().then((t) => (tokenRef.current = t ?? ''))
  }, [backend])

  useEffect(() => {
    comeca()
  }, [comeca])

  // hook de dev para a demo automatizada (fora do build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__cruz = puzzle
    }
  }, [puzzle])

  useEffect(() => {
    if (!puzzle || fim) return
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [puzzle, fim])

  const palavraAtiva: CruzPalavra | null = puzzle?.palavras[ativa] ?? null

  const completa = useCallback(
    (palavra: CruzPalavra, base: Record<string, string>) =>
      palavra.cells.every(([r, c]) => base[`${r}-${c}`]),
    [],
  )

  const digita = useCallback(
    (letra: string) => {
      if (!puzzle || fim || !palavraAtiva || !cursor) return
      const [r, c] = cursor
      const chave = `${r}-${c}`
      if (certas[chave]) return
      if (puzzle.solucao[r]![c] !== letra) {
        setErros((e) => e + 1)
        setTremendo(true)
        setTimeout(() => setTremendo(false), 400)
        return
      }
      const novas = { ...certas, [chave]: letra }
      setCertas(novas)
      // avança para a próxima casa vazia da palavra ativa
      const idx = palavraAtiva.cells.findIndex(([rr, cc]) => rr === r && cc === c)
      const proxima = palavraAtiva.cells.slice(idx + 1).find(([rr, cc]) => !novas[`${rr}-${cc}`])
      if (proxima) setCursor(proxima)
      // terminou tudo?
      const total = puzzle.palavras.every((p) => completa(p, novas))
      if (total) {
        const secs = Math.floor((Date.now() - startRef.current) / 1000)
        const letras = Object.keys(novas).length
        const pontos = Math.max(letras * 8 + 800 - secs * 3 - erros * 15, 150)
        setFim({ points: pontos })
        void backend.finish(tokenRef.current, pontos).then((res) => {
          if (res) {
            setFim({ points: res.points, rank: res.rank, best: res.best })
            void reload()
          }
        })
      }
    },
    [puzzle, fim, palavraAtiva, cursor, certas, erros, completa, reload, backend],
  )

  // teclado físico
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const l = e.key.toUpperCase()
      if (/^[A-Z]$/.test(l)) digita(l)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [digita])

  function clicaCasa(r: number, c: number) {
    if (!puzzle) return
    const donas = puzzle.palavras
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.cells.some(([rr, cc]) => rr === r && cc === c))
    if (donas.length === 0) return
    // clicar de novo na mesma casa alterna H/V quando há cruzamento
    const atualDona = donas.find(({ i }) => i === ativa)
    const proxima =
      cursor && cursor[0] === r && cursor[1] === c && atualDona && donas.length > 1
        ? donas.find(({ i }) => i !== ativa)!
        : (atualDona ?? donas[0]!)
    setAtiva(proxima.i)
    setCursor([r, c])
  }

  if (!puzzle) return null

  const numeroEm = new Map<string, number>()
  for (const p of puzzle.palavras) {
    const chave = `${p.linha}-${p.coluna}`
    if (!numeroEm.has(chave)) numeroEm.set(chave, p.numero)
  }
  const ativaSet = new Set(palavraAtiva?.cells.map(([r, c]) => `${r}-${c}`) ?? [])
  const horizontais = puzzle.palavras.filter((p) => p.dir === 'H')
  const verticais = puzzle.palavras.filter((p) => p.dir === 'V')

  const Dica = ({ p, i }: { p: CruzPalavra; i: number }) => (
    <button
      onClick={() => {
        setAtiva(i)
        setCursor(p.cells.find(([r, c]) => !certas[`${r}-${c}`]) ?? p.cells[0]!)
      }}
      className={`w-full rounded-lg px-2 py-1 text-left text-[13px] leading-snug transition ${
        i === ativa ? 'bg-pop-purple/25 ring-1 ring-pop-purple/60' : 'hover:bg-ink-800'
      } ${completa(p, certas) ? 'line-through opacity-50' : ''}`}
    >
      <b className="text-pop-cyan">{p.numero}.</b> {p.dica}{' '}
      <span className="text-text-muted">({p.palavra.length})</span>
    </button>
  )

  return (
    <main ref={fsRef} className="game-fs mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">✏️</span> Cruzadinha
          {backend.daily && <span className="ml-2 rounded-full bg-pop-yellow/20 px-2 py-0.5 align-middle text-xs font-bold text-pop-yellow">📅 desafio de hoje</span>}
        </h1>
        <div className="flex items-center gap-2">
          <FullscreenButton targetRef={fsRef} />
          <span className="text-sm font-bold text-text-muted">⏱️ <span className="tabular-nums">{segundos}s</span> · ❌ {erros}</span>
          {!backend.daily && (
            <button onClick={comeca} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
              Nova grade
            </button>
          )}
          <button onClick={() => navigate(backend.daily ? '/desafio' : '/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            {backend.daily ? 'Voltar aos desafios' : 'Voltar à mesa'}
          </button>
        </div>
      </div>

      {/* dica ativa em destaque */}
      {palavraAtiva && (
        <p className="mt-2 rounded-field bg-ink-900 px-4 py-2 text-sm font-bold ring-1 ring-pop-purple/40">
          <span className="text-pop-cyan">{palavraAtiva.numero} {palavraAtiva.dir === 'H' ? '→' : '↓'}</span>{' '}
          {palavraAtiva.dica} <span className="text-text-muted">({palavraAtiva.palavra.length} letras)</span>
        </p>
      )}

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative">
          <div
            className={`mx-auto grid w-fit max-w-full gap-0.5 rounded-2xl bg-ink-950/70 p-2 ring-1 ring-ink-700 ${tremendo ? 'animate-pulse' : ''}`}
            style={{ gridTemplateColumns: `repeat(${puzzle.tam}, minmax(0, 1fr))` }}
          >
            {puzzle.solucao.map((linha, r) =>
              linha.map((letra, c) => {
                const chave = `${r}-${c}`
                if (!letra) return <span key={chave} className="size-7 sm:size-9" />
                const numero = numeroEm.get(chave)
                const naAtiva = ativaSet.has(chave)
                const noCursor = cursor && cursor[0] === r && cursor[1] === c
                return (
                  <button
                    key={chave}
                    data-rc={chave}
                    onClick={() => clicaCasa(r, c)}
                    className={`relative flex size-7 items-center justify-center rounded-md font-display text-sm font-extrabold transition-colors sm:size-9 sm:text-lg ${
                      noCursor
                        ? 'bg-pop-purple text-white'
                        : naAtiva
                          ? 'bg-pop-purple/30 text-cream'
                          : 'bg-cream text-ink-950'
                    }`}
                  >
                    {numero && (
                      <span className={`absolute top-0 left-0.5 text-[8px] font-bold ${noCursor ? 'text-white/80' : 'text-ink-950/50'}`}>
                        {numero}
                      </span>
                    )}
                    {certas[chave] ?? ''}
                  </button>
                )
              }),
            )}
          </div>

          {/* teclado A–Z (toque) */}
          <div className="mx-auto mt-3 flex max-w-lg flex-wrap justify-center gap-1">
            {LETRAS.map((l) => (
              <button
                key={l}
                onClick={() => digita(l)}
                className="size-9 rounded-lg bg-ink-800 font-display text-sm font-extrabold ring-1 ring-ink-700 transition hover:-translate-y-0.5 hover:ring-pop-cyan"
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-text-muted">
            Letra errada não entra — mas custa 15 pontos. Clique 2× numa casa de cruzamento para alternar → / ↓.
          </p>

          {fim && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/85">
              <p className="text-5xl" aria-hidden="true">✏️</p>
              <p className="font-display text-3xl font-extrabold text-pop-green">Cruzadinha fechada!</p>
              <p className="font-display text-2xl font-extrabold text-pop-yellow">{fim.points} pts</p>
              {fim.rank && <p className="text-sm text-text-muted">posição {fim.rank}º no ranking{backend.daily ? ' de hoje' : ''}</p>}
              {isGuest && <p className="text-sm text-text-muted">Convidados não pontuam no ranking.</p>}
              {backend.daily ? (
                <button onClick={() => navigate('/desafio')} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                  Ver desafios de hoje
                </button>
              ) : (
                <button onClick={comeca} className="btn-pop mt-2 bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white">
                  Outra grade
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-3">
            <p className="mb-1 font-display text-sm font-bold">→ Horizontais</p>
            {horizontais.map((p) => (
              <Dica key={`${p.numero}H${p.palavra}`} p={p} i={puzzle.palavras.indexOf(p)} />
            ))}
            <p className="mt-2 mb-1 font-display text-sm font-bold">↓ Verticais</p>
            {verticais.map((p) => (
              <Dica key={`${p.numero}V${p.palavra}`} p={p} i={puzzle.palavras.indexOf(p)} />
            ))}
          </div>
          <div className="card p-4">
            <p className="font-display text-sm font-bold">🏆 Ranking {backend.daily ? 'de hoje' : '(30 dias)'}</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {!board?.rows.length && <p className="text-sm text-text-muted">Feche uma grade e abra o placar!</p>}
              {board?.rows.map((row) => (
                <div key={row.userId} className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700">
                  <span className={`w-7 font-display font-extrabold ${row.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{row.rank}º</span>
                  <AvatarSvg id={row.displayName} size={20} />
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
