import { useMemo, useState } from 'react'
import {
  playableSides,
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

function Tile({ tile, small = false }: { tile: DominoTile; small?: boolean }) {
  const cls = small ? 'h-9 w-[4.5rem] text-sm' : 'h-11 w-[5.5rem] text-base'
  return (
    <span
      className={`inline-flex ${cls} shrink-0 items-stretch overflow-hidden rounded-lg bg-cream font-display font-extrabold text-ink-950 ring-1 ring-ink-950/30`}
    >
      <span className="flex flex-1 items-center justify-center">{tile[0]}</span>
      <span className="w-px bg-ink-950/30" />
      <span className="flex flex-1 items-center justify-center">{tile[1]}</span>
    </span>
  )
}

/**
 * Mesa de Dominó. `yourSeat === -1` = espectador (sem mão).
 * Lances validados no servidor; aqui a mesma lógica só destaca opções.
 */
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
  const pseudo = { awaitingOpener: view.awaitingOpener, line: view.line } as DominoState

  const canPlaySomething = useMemo(
    () => view.yourHand.some((t) => playableSides(pseudo, t).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view],
  )

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

  return (
    <div className="flex flex-col gap-4">
      {/* jogadores em volta da mesa */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((seat) => {
          const p = bySeat(seat)
          const team = TEAM_STYLE[teamOf(seat)]!
          const isTurn = view.turn === seat
          return (
            <div
              key={seat}
              className={`card flex items-center gap-2 p-3 ${isTurn ? 'ring-2 ring-pop-yellow' : ''}`}
            >
              <span className={`size-3 shrink-0 rounded-full ${team.dot}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {p?.name ?? '—'}{' '}
                  {seat === yourSeat && <span className="text-text-muted">(você)</span>}
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

      {/* a linha na mesa */}
      <div className="card min-h-36 p-4">
        {view.line.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            A mesa abre com o <strong>[6|6]</strong>…
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {view.line.map((tile, i) => (
              <Tile key={`${tile[0]}-${tile[1]}-${i}`} tile={tile} small />
            ))}
          </div>
        )}
        {view.lastAction?.type === 'pass' && (
          <p className="mt-2 text-center text-xs font-bold text-pop-orange">
            {bySeat(view.lastAction.seat)?.name ?? 'Alguém'} passou a vez
          </p>
        )}
      </div>

      {/* sua mão (jogador) */}
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
              <span className="text-xs text-text-muted">aguarde…</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.yourHand.map((tile, i) => {
              const playable = yourTurn && playableSides(pseudo, tile).length > 0
              return (
                <button
                  key={`${tile[0]}-${tile[1]}-${i}`}
                  onClick={() => clickTile(tile)}
                  disabled={!playable}
                  className={`transition ${playable ? 'cursor-pointer hover:-translate-y-1 drop-shadow-[0_0_8px_rgba(85,224,127,0.6)]' : 'opacity-50'}`}
                  aria-label={`pedra ${tile[0]} ${tile[1]}`}
                >
                  <Tile tile={tile} />
                </button>
              )
            })}
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
            <div className="mt-3 flex items-center gap-2 rounded-field bg-ink-900 p-3 ring-1 ring-ink-700">
              <Tile tile={pendingTile} small />
              <span className="text-sm text-text-muted">encaixa dos dois lados:</span>
              <button
                onClick={() => {
                  onAction({ type: 'play', tile: pendingTile, side: 'left' })
                  setPendingTile(null)
                }}
                className="btn-pop px-4 py-1.5 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
              >
                ◀ Esquerda
              </button>
              <button
                onClick={() => {
                  onAction({ type: 'play', tile: pendingTile, side: 'right' })
                  setPendingTile(null)
                }}
                className="btn-pop px-4 py-1.5 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
              >
                Direita ▶
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-text-muted">
          👀 Você está assistindo — as mãos dos jogadores ficam escondidas.
        </p>
      )}
    </div>
  )
}
