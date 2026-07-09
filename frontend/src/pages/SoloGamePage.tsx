import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { useFullscreen } from '../lib/useFullscreen'
import AdSlot from '../components/AdSlot'
import { startLoop, type GameHost, type Input } from '../engine/core'
import { DesvioGame, DESVIO_W, DESVIO_H } from '../games/desvio'
import { EsquadraoGame, ESQ_W, ESQ_H } from '../games/esquadrao'
import { CardumeGame, CARDUME_W, CARDUME_H } from '../games/cardume'
import { SnakeGame, SNAKE_W, SNAKE_H } from '../games/snake'
import { CampoMinadoGame, MINAS_W, MINAS_H } from '../games/campoMinado'
import { InvasoresGame, INV_W, INV_H } from '../games/invasores'
import { ComeComeGame, COME_W, COME_H } from '../games/comeCome'
import { PegaLadraoGame, PEGA_W, PEGA_H } from '../games/pegaLadrao'
import { MissaoElevadorGame, ELEV_W, ELEV_H } from '../games/missaoElevador'
import { PuzzleGame, PUZZLE_W, PUZZLE_H } from '../games/puzzle'

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
  /** botões FORA do canvas (jogos de grade: nada pode cobrir o tabuleiro) */
  actionsOutside?: boolean
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
  snake: {
    slug: 'snake',
    title: 'Snake',
    icon: '🐍',
    width: SNAKE_W,
    height: SNAKE_H,
    wide: true,
    controls:
      'Setas/WASD ou DESLIZE o dedo na direção. Coma as frutas para crescer — e não bata na parede nem em você mesma. Fica mais rápido a cada mordida!',
    create: (cb) => new SnakeGame(cb),
  },
  'campo-minado': {
    slug: 'campo-minado',
    title: 'Campo Minado',
    icon: '💣',
    width: MINAS_W,
    height: MINAS_H,
    wide: true,
    controls:
      'Toque/clique para revelar. SEGURE (ou use o botão 🚩) para marcar bandeira. O primeiro clique é sempre seguro. Cada casa vale pontos — limpar o campo rápido vale bônus!',
    actionsOutside: true,
    actions: [
      {
        id: 'bandeira',
        icon: '🚩',
        label: 'Bandeira',
        invoke: (g) => (g as CampoMinadoGame).toggleFlagMode(),
      },
    ],
    create: (cb) => new CampoMinadoGame(cb),
  },
  invasores: {
    slug: 'invasores',
    title: 'Invasores',
    icon: '👾',
    width: INV_W,
    height: INV_H,
    controls:
      'Setas/WASD ou arraste o dedo — o fogo é automático. Segure as fileiras antes que desçam até as barreiras. Acerte a nave dourada para o bônus!',
    create: (cb) => new InvasoresGame(cb),
  },
  'come-come': {
    slug: 'come-come',
    title: 'Come-Come',
    icon: '🟡',
    width: COME_W,
    height: COME_H,
    wide: true,
    controls:
      'Setas/WASD ou DESLIZE o dedo. Coma todas as pastilhas fugindo dos 4 fantasmas — cada um caça de um jeito. A pastilha grande INVERTE a caçada!',
    create: (cb) => new ComeComeGame(cb),
  },
  'pega-ladrao': {
    slug: 'pega-ladrao',
    title: 'Pega-Ladrão',
    icon: '👮',
    width: PEGA_W,
    height: PEGA_H,
    controls:
      '←/→ ou arraste para correr; ↑ (ou botão) PULA carrinhos e bolas; ↓ (ou botão) ABAIXA dos aviõezinhos. As escadas rolantes ficam nas pontas. Pegue o ladrão antes do tempo acabar — cada segundo que sobra vira ponto!',
    actions: [
      { id: 'pular', icon: '⤴', label: 'Pular', invoke: (g) => (g as PegaLadraoGame).triggerJump() },
      { id: 'abaixar', icon: '⤵', label: 'Abaixar', invoke: (g) => (g as PegaLadraoGame).triggerDuck() },
    ],
    create: (cb) => new PegaLadraoGame(cb),
  },
  'missao-elevador': {
    slug: 'missao-elevador',
    title: 'Missão Elevador',
    icon: '🛗',
    width: ELEV_W,
    height: ELEV_H,
    controls:
      '←/→ anda; o ELEVADOR sobe e desce sozinho — entre quando ele parar no seu andar (dá para atirar e abaixar lá de dentro). ↓ ABAIXA: esquiva dos tiros altos e atira rasteiro. ↑ PULA — atire pulando para APAGAR as lâmpadas e escurecer a área! Espaço atira. Recolha os documentos das portas VERMELHAS e desça até a garagem!',
    actions: [
      { id: 'tiro', icon: '✦', label: 'Tiro', invoke: (g) => (g as MissaoElevadorGame).triggerShoot() },
      { id: 'pular', icon: '⤴', label: 'Pular', invoke: (g) => (g as MissaoElevadorGame).triggerJump() },
      { id: 'abaixar', icon: '⤵', label: 'Abaixar', invoke: (g) => (g as MissaoElevadorGame).triggerDuck() },
    ],
    create: (cb) => new MissaoElevadorGame(cb),
  },
  puzzle: {
    slug: 'puzzle',
    title: 'Puzzle',
    icon: '🧩',
    width: PUZZLE_W,
    height: PUZZLE_H,
    wide: true,
    controls:
      'Toque em DUAS peças para trocá-las de lugar até montar a imagem. Peça no lugar certo ganha um pontinho verde. Menos trocas e menos tempo = mais pontos — são 3 níveis!',
    create: (cb) => new PuzzleGame(cb),
  },
}

export default function SoloGamePage({ def }: { def: SoloGameDef }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !!user?.isGuest
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fsRef = useRef<HTMLDivElement>(null)
  const { isFs, toggle: toggleFs } = useFullscreen(fsRef)
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

  // hook de dev para testes automatizados de UI (não existe no build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__solo = gameRef
    }
  }, [])

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
    // convidados jogam sem registrar pontuação — ranking pede conta
    setResult(null)
    setSubmitError('')
    if (isGuest) {
      matchIdRef.current = null
    } else {
      void api<{ matchId: string }>('/api/solo/start', { body: { gameSlug: def.slug } })
        .then((r) => {
          matchIdRef.current = r.matchId
        })
        .catch(() => {
          matchIdRef.current = null
        })
    }

    return () => {
      stop()
      game.input.detach()
      gameRef.current = null
    }
  }, [phase, runNumber, def, finish, isGuest])

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
        <div className="flex gap-2">
          <button
            onClick={() => void toggleFs()}
            className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
          >
            {isFs ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'}
          </button>
          <button
            onClick={() => navigate('/mesa')}
            className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange"
          >
            Voltar à mesa
          </button>
        </div>
      </div>

      <div ref={fsRef} className={`game-fs mt-5 grid items-start gap-5 ${def.wide ? '' : 'lg:grid-cols-[minmax(0,1fr)_300px]'}`}>
        {/* jogo */}
        <div className={`relative mx-auto w-full ${def.wide ? 'max-w-4xl' : 'max-w-md'}`}>
          <canvas
            ref={canvasRef}
            width={def.width}
            height={def.height}
            className="mx-auto block w-full touch-none rounded-card ring-2 ring-ink-700"
            style={{ maxHeight: 'calc(100vh - 140px)', width: 'auto', maxWidth: '100%' }}
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
            <div
              className={
                def.actionsOutside
                  ? 'mt-3 flex justify-end gap-2'
                  : 'absolute right-3 bottom-3 flex flex-col gap-2'
              }
            >
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
              {isGuest && (
                <p className="max-w-xs text-sm text-text-muted">
                  Jogando como convidado — sua pontuação não entra no ranking.{' '}
                  <Link to="/criar-conta" className="font-bold text-pop-cyan hover:underline">
                    Crie sua conta
                  </Link>{' '}
                  para competir!
                </p>
              )}
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
          <AdSlot className="mt-4" />
        </div>
      </div>
    </main>
  )
}
