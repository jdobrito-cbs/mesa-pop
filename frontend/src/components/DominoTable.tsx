import { useMemo, useState } from 'react'
import {
  playableSides,
  type ArmIndex,
  type DominoAction,
  type DominoState,
  type DominoTile,
  type DominoView,
} from '@mesapop/shared'

const SEAT_LABEL = ['A', 'B', 'C', 'D']
const teamOf = (seat: number) => seat % 2
const TEAM_STYLE = [
  { dot: 'bg-pop-magenta', text: 'text-pop-magenta', name: 'Dupla Magenta' },
  { dot: 'bg-pop-cyan', text: 'text-pop-cyan', name: 'Dupla Ciano' },
]
const ARM_LABEL = ['direita →', '← esquerda', '↑ cima', '↓ baixo']

/* ---------- pedra com pontinhos (pips) ---------- */

const PIP_POS: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

/** metade de pedra (1×1) com pips, desenhada em coordenadas locais */
function Half({ value, x, y, size }: { value: number; x: number; y: number; size: number }) {
  const pad = size * 0.22
  const gap = (size - 2 * pad) / 2
  return (
    <>
      {PIP_POS[value]!.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={x + pad + cx * gap}
          cy={y + pad + cy * gap}
          r={size * 0.09}
          fill="#1B1235"
        />
      ))}
    </>
  )
}

/** pedra completa no tabuleiro: horizontal = deitada [a|b]; senão em pé */
function BoardTile({
  tile,
  cx,
  cy,
  horizontal,
  unit,
  highlight = false,
}: {
  tile: DominoTile
  cx: number
  cy: number
  horizontal: boolean
  unit: number
  highlight?: boolean
}) {
  const w = horizontal ? 2 * unit : unit
  const h = horizontal ? unit : 2 * unit
  const x = cx - w / 2
  const y = cy - h / 2
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={unit * 0.16}
        fill="#FFF9F0"
        stroke={highlight ? '#FFC53D' : '#1B1235'}
        strokeWidth={highlight ? 2.5 : 1.2}
      />
      {horizontal ? (
        <>
          <line x1={cx} y1={y + 3} x2={cx} y2={y + h - 3} stroke="#1B1235" strokeWidth={1.2} />
          <Half value={tile[0]} x={x} y={y} size={unit} />
          <Half value={tile[1]} x={cx} y={y} size={unit} />
        </>
      ) : (
        <>
          <line x1={x + 3} y1={cy} x2={x + w - 3} y2={cy} stroke="#1B1235" strokeWidth={1.2} />
          <Half value={tile[0]} x={x} y={y} size={unit} />
          <Half value={tile[1]} x={x} y={cy} size={unit} />
        </>
      )}
    </g>
  )
}

/* ---------- layout: braços a partir do spinner, dobrando para os cantos ---------- */

interface Placed {
  tile: DominoTile
  cx: number
  cy: number
  horizontal: boolean
}

const isDouble = (t: DominoTile) => t[0] === t[1]

/**
 * Posiciona as pedras em unidades (1 = meia pedra). O spinner fica em pé no
 * centro; cada braço cresce na sua direção e DOBRA rumo ao seu canto quando
 * alcança o limite — o desenho clássico da mesa de dominó.
 */
function layoutBoard(view: DominoView): { placed: Placed[]; bounds: [number, number, number, number] } {
  const placed: Placed[] = []
  if (!view.spinner) return { placed, bounds: [-4, -3, 8, 6] }

  // spinner em pé no centro
  placed.push({ tile: view.spinner, cx: 0, cy: 0, horizontal: false })

  const LIMIT_X = 9
  const LIMIT_Y = 6

  const startFor: Record<number, { x: number; y: number; dx: number; dy: number }> = {
    0: { x: 0.5, y: 0, dx: 1, dy: 0 },
    1: { x: -0.5, y: 0, dx: -1, dy: 0 },
    2: { x: 0, y: -1, dx: 0, dy: -1 },
    3: { x: 0, y: 1, dx: 0, dy: 1 },
  }
  // dobra de cada braço rumo ao seu canto: dir→baixo, esq→cima, cima→dir, baixo→esq
  const bendFor: Record<number, { dx: number; dy: number }> = {
    0: { dx: 0, dy: 1 },
    1: { dx: 0, dy: -1 },
    2: { dx: 1, dy: 0 },
    3: { dx: -1, dy: 0 },
  }

  for (const arm of [0, 1, 2, 3] as ArmIndex[]) {
    let { x, y, dx, dy } = startFor[arm]!
    let bends = 0
    for (const tile of view.arms[arm]!) {
      const along = isDouble(tile) ? 1 : 2
      // precisa dobrar?
      const nx = x + dx * along
      const ny = y + dy * along
      if (bends === 0 && ((dx !== 0 && Math.abs(nx) > LIMIT_X) || (dy !== 0 && Math.abs(ny) > LIMIT_Y))) {
        const b = bendFor[arm]!
        dx = b.dx
        dy = b.dy
        bends = 1
      } else if (bends === 1 && ((dx !== 0 && Math.abs(x + dx * along) > LIMIT_X) || (dy !== 0 && Math.abs(y + dy * along) > LIMIT_Y + 3))) {
        // segunda dobra: volta para dentro
        const s = startFor[arm]!
        dx = -s.dx
        dy = -s.dy
        bends = 2
      }
      const len = isDouble(tile) ? 1 : 2
      const cx = x + (dx * len) / 2
      const cy = y + (dy * len) / 2
      const movingHorizontally = dx !== 0
      // carroça fica ATRAVESSADA (perpendicular ao movimento)
      const horizontal = isDouble(tile) ? !movingHorizontally : movingHorizontally
      // orienta visualmente a pedra no sentido do braço
      const t: DominoTile =
        movingHorizontally
          ? dx > 0
            ? tile
            : [tile[1], tile[0]]
          : dy > 0
            ? tile
            : [tile[1], tile[0]]
      placed.push({ tile: t, cx, cy, horizontal })
      x += dx * len
      y += dy * len
    }
  }

  const xs = placed.flatMap((p) => [p.cx - 1.2, p.cx + 1.2])
  const ys = placed.flatMap((p) => [p.cy - 1.2, p.cy + 1.2])
  const minX = Math.min(...xs, -4)
  const maxX = Math.max(...xs, 4)
  const minY = Math.min(...ys, -3)
  const maxY = Math.max(...ys, 3)
  return { placed, bounds: [minX, minY, maxX - minX, maxY - minY] }
}

/* ---------- pedra da mão (botão) ---------- */

function HandTile({ tile, playable, onClick }: { tile: DominoTile; playable: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!playable}
      aria-label={`pedra ${tile[0]} ${tile[1]}`}
      className={`transition ${playable ? 'cursor-pointer hover:-translate-y-1 drop-shadow-[0_0_10px_rgba(255,197,61,0.65)]' : 'opacity-45'}`}
    >
      <svg width={38} height={72} viewBox="0 0 20 40" aria-hidden="true">
        <rect x={0.8} y={0.8} width={18.4} height={38.4} rx={3} fill="#FFF9F0" stroke="#1B1235" strokeWidth={1.2} />
        <line x1={3} y1={20} x2={17} y2={20} stroke="#1B1235" strokeWidth={1.1} />
        <Half value={tile[0]} x={0} y={0} size={20} />
        <Half value={tile[1]} x={0} y={20} size={20} />
      </svg>
    </button>
  )
}

/* ---------- a mesa ---------- */

export default function DominoTable({
  view,
  yourSeat,
  players,
  onAction,
}: {
  view: DominoView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onAction: (action: DominoAction) => void
}) {
  const [pendingTile, setPendingTile] = useState<DominoTile | null>(null)
  const yourTurn = yourSeat >= 0 && view.turn === yourSeat

  const pseudo = useMemo(
    () =>
      ({
        winnerSeats: view.winnerSeats,
        draw: view.draw,
        awaitingOpener: view.awaitingOpener,
        spinner: view.spinner,
        arms: view.arms,
      }) as DominoState,
    [view],
  )

  const canPlaySomething = useMemo(
    () => view.yourHand.some((t) => playableSides(pseudo, t).length > 0),
    [view.yourHand, pseudo],
  )

  const { placed, bounds } = useMemo(() => layoutBoard(view), [view])
  const UNIT = 24
  const [bx, by, bw, bh] = bounds

  function clickTile(tile: DominoTile) {
    if (!yourTurn) return
    const sides = playableSides(pseudo, tile)
    if (sides.length === 0) return
    if (sides.length === 1) {
      onAction({ type: 'play', tile, side: sides[0]! })
      setPendingTile(null)
    } else {
      setPendingTile(tile)
    }
  }

  const bySeat = (seat: number) => players.find((p) => p.seat === seat)
  const pendingSides = pendingTile ? playableSides(pseudo, pendingTile) : []

  return (
    <div className="flex flex-col gap-4">
      {/* placar da partida (All Fives até o alvo) */}
      <div className="card flex flex-wrap items-center justify-center gap-x-6 gap-y-2 p-3">
        <p className="font-display text-lg font-extrabold">
          <span className="text-pop-magenta">{view.scores[0]}</span>
          <span className="mx-2 text-text-muted">×</span>
          <span className="text-pop-cyan">{view.scores[1]}</span>
        </p>
        <p className="text-xs font-bold tracking-wide text-text-muted uppercase">
          mão {view.handNumber} · pontas somam {view.endsSum}
        </p>
        {view.lastMoveScore && (
          <span className="animate-float rounded-full bg-pop-yellow/20 px-3 py-1 text-sm font-extrabold text-pop-yellow">
            +{view.lastMoveScore.points} pts — {bySeat(view.lastMoveScore.seat)?.name}!
          </span>
        )}
      </div>

      {/* mão encerrada com placar empatado → desempate em nova mão */}
      {view.lastHandResult && view.awaitingOpener && (
        <div className="card border-l-4 border-l-pop-yellow p-3 text-sm">
          <span>
            {view.lastHandResult.kind === 'bate'
              ? `${bySeat(view.lastHandResult.seat ?? -1)?.name ?? 'Alguém'} bateu`
              : 'Mão trancada'}{' '}
            com o placar empatado ({view.lastHandResult.scores[0]} ×{' '}
            {view.lastHandResult.scores[1]}) — nova mão para desempatar! Quem tem o [6|6] abre.
          </span>
        </div>
      )}

      {/* jogadores em volta da mesa */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((seat) => {
          const p = bySeat(seat)
          const team = TEAM_STYLE[teamOf(seat)]!
          const isTurn = view.turn === seat
          return (
            <div key={seat} className={`card flex items-center gap-2 p-3 ${isTurn ? 'ring-2 ring-pop-yellow' : ''}`}>
              <span className={`size-3 shrink-0 rounded-full ${team.dot}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {p?.name ?? '—'} {seat === yourSeat && <span className="text-text-muted">(você)</span>}
                </p>
                <p className="text-xs text-text-muted">
                  {SEAT_LABEL[seat]} · {view.handCounts[seat] ?? 0} pedras
                  {p && !p.connected && <span className="text-pop-orange"> · caiu</span>}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* A MESA — feltro com a linha crescendo para os 4 cantos */}
      <div className="overflow-hidden rounded-card ring-2 ring-ink-700">
        <svg
          viewBox={`${bx * UNIT} ${by * UNIT} ${bw * UNIT} ${bh * UNIT}`}
          className="block h-auto w-full"
          style={{ background: 'radial-gradient(ellipse at center, #2E9257 0%, #1E6B3E 70%, #175732 100%)' }}
          role="img"
          aria-label="Mesa de dominó"
        >
          {placed.length === 0 ? (
            <text x={0} y={0} textAnchor="middle" fill="#FFF9F0" opacity={0.75} fontSize={13} fontWeight={700}>
              A mesa abre com o [6|6]…
            </text>
          ) : (
            placed.map((p, i) => (
              <BoardTile
                key={i}
                tile={p.tile}
                cx={p.cx * UNIT}
                cy={p.cy * UNIT}
                horizontal={p.horizontal}
                unit={UNIT}
                highlight={i === 0}
              />
            ))
          )}
        </svg>
      </div>
      {view.lastAction?.type === 'pass' && (
        <p className="-mt-2 text-center text-xs font-bold text-pop-orange">
          {bySeat(view.lastAction.seat)?.name ?? 'Alguém'} passou a vez
        </p>
      )}

      {/* sua mão */}
      {yourSeat >= 0 ? (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">
              Sua mão{' '}
              <span className={TEAM_STYLE[teamOf(yourSeat)]!.text}>
                ({TEAM_STYLE[teamOf(yourSeat)]!.name})
              </span>
            </p>
            {yourTurn ? (
              <span className="rounded-full bg-pop-yellow/15 px-3 py-1 text-xs font-bold text-pop-yellow">
                Sua vez!
              </span>
            ) : (
              <span className="text-xs text-text-muted">vez de {bySeat(view.turn)?.name ?? '…'}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.yourHand.map((tile, i) => (
              <HandTile
                key={`${tile[0]}-${tile[1]}-${i}`}
                tile={tile}
                playable={yourTurn && playableSides(pseudo, tile).length > 0}
                onClick={() => clickTile(tile)}
              />
            ))}
          </div>
          {yourTurn && !canPlaySomething && (
            <button
              onClick={() => onAction({ type: 'pass' })}
              className="btn-pop mt-3 bg-pop-orange/20 px-5 py-2 text-sm font-bold text-pop-orange ring-1 ring-pop-orange/50"
            >
              Passar a vez
            </button>
          )}
          {pendingTile && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-field bg-ink-900 p-3 ring-1 ring-ink-700">
              <span className="text-sm text-text-muted">
                [{pendingTile[0]}|{pendingTile[1]}] encaixa em mais de uma ponta:
              </span>
              {pendingSides.map((side) => (
                <button
                  key={side}
                  onClick={() => {
                    onAction({ type: 'play', tile: pendingTile, side })
                    setPendingTile(null)
                  }}
                  className="btn-pop px-4 py-1.5 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
                >
                  {ARM_LABEL[side]} ({view.openEnds[side]})
                </button>
              ))}
              <button
                onClick={() => setPendingTile(null)}
                className="btn-pop px-3 py-1.5 text-xs text-text-muted ring-1 ring-ink-700"
              >
                cancelar
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-text-muted">
          👀 Você está assistindo — as pedras dos jogadores ficam escondidas.
        </p>
      )}
    </div>
  )
}
