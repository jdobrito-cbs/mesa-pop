import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { startLoop, type GameHost, type Input } from '../engine/core'
import { DesvioGame, DESVIO_W, DESVIO_H } from '../games/desvio'
import { EsquadraoGame, ESQ_W, ESQ_H } from '../games/esquadrao'
import { CardumeGame, CARDUME_W, CARDUME_H } from '../games/cardume'

interface LeaderRow {
  rank: number
  userId: string
  displayName: string
  points: number
}

interface FinishResult {
  points: number
  best: number
  rank: number
  isRecord: boolean
}

type SoloGame = GameHost & { input: Input }

interface TouchAction {
  id: string
  icon: string
  label: string
  invoke(game: SoloGame): void
  /** desabilitado com base no HUD atual */
  disabled?(hud: Record<string, unknown>): boolean
}

export interface SoloGameDef {
  slug: string
  title: string
  icon: string
  width: number
  height: number
  /** canvas paisagem: ocupa a largura toda (leaderboard vai para baixo) */
  wide?: boolean
  controls: string
  /** botões de toque sobre o canvas (celular/tablet) */
  actions?: TouchAction[]
  create(callbacks: {
    onGameOver(points: number): void
    onHud(hud: Record<string, unknown>): void
  }): SoloGame
}

export const SOLO_GAMES: Record<string, SoloGameDef> = {
  cardume: {
    slug: 'cardume',
    title: 'Cardume',
    icon: '🐠',
    width: CARDUME_W,
    height: CARDUME_H,
    wide: true,
    controls:
      'Mova o ponteiro (ou setas): o cardume segue. Toque rápido/espaço: os peixes se ESPALHAM. Segure/Shift: eles ORBITAM em alta velocidade — sua arma contra os peixões. Coma peixinhos dourados para crescer!',
    create: (cb) => new CardumeGame(cb),
  },
  'nave-espacial': {
    slug: 'nave-espacial',
    title: 'Desvio Estelar',
    icon: '🚀',
    width: DESVIO_W,
    height: DESVIO_H,
    controls: 'Setas/WASD ou arraste o dedo — apenas DESVIE. Um toque e já era.',
    create: (cb) => new DesvioGame(cb),
  },
  'esquadrao-1942': {
    slug: 'esquadrao-1942',
    title: 'Esquadrão 42',
    icon: '✈️',
    width: ESQ_W,
    height: ESQ_H,
    controls:
      'Setas/WASD ou arraste o dedo. Fogo automático; pegue armas no caminho (E, L, M). Espaço/B = bomba. L/Shift = LOOP de escape. Destrua carros, tanques, helicópteros e aviões — e o BOSS a cada 5 minutos!',
    actions: [
      {
        id: 'loop',
        icon: '➰',
        label: 'Loop',
        invoke: (g) => (g as EsquadraoGame).triggerLoop(),
        disabled: (hud) => hud.loopReady === false,
      },
      {
        id: 'bomba',
        icon: '✹',
        label: 'Bomba',
        invoke: (g) => (g as EsquadraoGame).triggerBomb(),
        disabled: (hud) => !hud.bombs,
      },
    ],
    create: (cb) => new EsquadraoGame(cb),
  },
}

export default function SoloGamePage({ def }: { def: SoloGameDef }) {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<SoloGame | null>(null)
  const matchIdRef = useRef<string | null>(null)
  const [hud, setHud] = useState<Record<string, unknown>>({})
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [result, setResult] = useState<FinishResult | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [runNumber, setRunNumber] = useState(0)

  const { data: leaderboard, reload: reloadBoard } = useFetch<{ rows: LeaderRow[] }>(
    `/api/leaderboards/${def.slug}`,
  )

  const finish = useCallback(
    async (points: number) => {
      setPhase('over')
      const matchId = matchIdRef.current
      if (!matchId) return
      try {
        const res = await api<FinishResult>('/api/solo/finish', { body: { matchId, points } })
        setResult(res)
        void reloadBoard()
      } catch (err) {
        setSubmitError(
          err instanceof ApiRequestError ? err.message : 'Não deu para registrar a pontuação',
        )
      }
    },
    [reloadBoard],
  )

  // monta o jogo quando entra em 'playing'
  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return

    const game = def.create({
      onGameOver: (points) => void finish(points),
      onHud: (h) => setHud(h),
    })
    gameRef.current = game
    game.input.attach(canvas, (px, py) => ({ x: px, y: py }))
    const stop = startLoop(canvas, game)

    // abre a partida no servidor (mede a duração de lá)
    setResult(null)
    setSubmitError('')
    void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: def.slug } })
      .then((r) => {
        matchIdRef.current = r.matchId
      })
      .catch(() => {
        matchIdRef.current = null
      })

    return () => {
      stop()
      game.input.detach()
      gameRef.current = null
    }
  }, [phase, runNumber, def, finish])

  const start = () => {
    setPhase('playing')
    setRunNumber((n) => n + 1)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">{def.icon}</span> {def.title}
        </h1>
        <button
          onClick={() => navigate('/mesa')}
          className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange"
        >
          Voltar à mesa
        </button>
      </div>

      <div className={`mt-5 grid items-start gap-5 ${def.wide ? '' : 'lg:grid-cols-[minmax(0,1fr)_300px]'}`}>
        {/* jogo */}
        <div className={`relative mx-auto w-full ${def.wide ? 'max-w-4xl' : 'max-w-md'}`}>
          <canvas
            ref={canvasRef}
            width={def.width}
            height={def.height}
            className="block w-full touch-none rounded-card ring-2 ring-ink-700"
            aria-label={def.title}
          />

          {/* HUD */}
          {phase === 'playing' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 font-display text-sm font-bold">
              <span className="rounded-full bg-ink-950/70 px-3 py-1 text-pop-yellow tabular-nums">
                {String(hud.points ?? 0)} pts
              </span>
              {'lives' in hud && (
                <span className="rounded-full bg-ink-950/70 px-3 py-1 text-pop-magenta">
                  {'♥'.repeat(Number(hud.lives ?? 0))}
                </span>
              )}
              {'weapon' in hud && (
                <span className="rounded-full bg-ink-950/70 px-3 py-1 text-pop-cyan">
                  {String(hud.weapon)}
                  {hud.ammo !== null && hud.ammo !== undefined ? ` ×${hud.ammo}` : ''}
                  {Number(hud.bombs ?? 0) > 0 ? ` · ✹${hud.bombs}` : ''}
                </span>
              )}
            </div>
          )}

          {/* botões de toque (celular/tablet) */}
          {phase === 'playing' && def.actions && (
            <div className="absolute right-3 bottom-3 flex flex-col gap-2">
              {def.actions.map((a) => {
                const off = a.disabled?.(hud) ?? false
                return (
                  <button
                    key={a.id}
                    aria-label={a.label}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      if (!off && gameRef.current) a.invoke(gameRef.current)
                    }}
                    className={`flex size-14 flex-col items-center justify-center rounded-full bg-ink-950/75 font-display text-xl ring-2 backdrop-blur transition select-none ${
                      off
                        ? 'text-text-muted/50 ring-ink-700 opacity-60'
                        : 'text-pop-yellow ring-pop-yellow/60 active:scale-90'
                    }`}
                  >
                    <span aria-hidden="true">{a.icon}</span>
                    <span className="text-[9px] font-bold tracking-wide uppercase">{a.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* pronto para jogar */}
          {phase === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-card bg-ink-950/85 p-6 text-center">
              <p className="text-5xl" aria-hidden="true">{def.icon}</p>
              <h2 className="font-display text-2xl font-extrabold">{def.title}</h2>
              <p className="max-w-xs text-sm text-text-muted">{def.controls}</p>
              <button
                onClick={start}
                className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-8 py-3.5 text-white shadow-lg shadow-pop-purple/25"
              >
                Jogar!
              </button>
            </div>
          )}

          {/* game over */}
          {phase === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card bg-ink-950/90 p-6 text-center">
              <p className="text-5xl" aria-hidden="true">{result?.isRecord ? '🏆' : '💫'}</p>
              <h2 className="font-display text-3xl font-extrabold">
                {result?.isRecord ? 'Novo recorde!' : 'Fim de jogo'}
              </h2>
              <p className="font-display text-4xl font-extrabold text-pop-yellow tabular-nums">
                {result?.points ?? String(hud.points ?? 0)} pts
              </p>
              {result && (
                <p className="text-sm text-text-muted">
                  Seu recorde: <strong className="text-text">{result.best}</strong> · posição{' '}
                  <strong className="text-pop-cyan">{result.rank}º</strong> no ranking
                </p>
              )}
              {submitError && <p className="text-sm font-semibold text-pop-orange">{submitError}</p>}
              <div className="mt-2 flex gap-3">
                <button
                  onClick={start}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3 text-white"
                >
                  Jogar de novo
                </button>
                <button
                  onClick={() => navigate('/mesa')}
                  className="btn-pop px-6 py-3 ring-2 ring-ink-700 hover:ring-pop-cyan"
                >
                  Minha mesa
                </button>
              </div>
            </div>
          )}
        </div>

        {/* leaderboard */}
        <div className="card p-4">
          <p className="font-display text-sm font-bold">🏆 Ranking (30 dias)</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {!leaderboard?.rows.length && (
              <p className="text-sm text-text-muted">
                Ninguém pontuou ainda — seja a primeira lenda deste placar!
              </p>
            )}
            {leaderboard?.rows.map((r) => (
              <div
                key={r.userId}
                className="flex items-center gap-2 rounded-field bg-ink-900 px-3 py-1.5 text-sm ring-1 ring-ink-700"
              >
                <span className={`w-7 font-display font-extrabold ${r.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>
                  {r.rank}º
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.displayName}</span>
                <span className="font-bold text-pop-cyan tabular-nums">{r.points}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">
            Pontuações são validadas no servidor — jogadas impossíveis não entram no ranking.
          </p>
        </div>
      </div>
    </main>
  )
}
