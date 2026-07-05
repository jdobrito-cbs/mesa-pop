import { useMemo, useState } from 'react'
import {
  countPieces,
  isDark,
  legalMoves,
  type CheckersMove,
  type CheckersState,
} from '@mesapop/shared'

/**
 * Tabuleiro de Damas. O estado vem do servidor; os lances legais são
 * calculados localmente com a MESMA lógica compartilhada (o servidor
 * revalida tudo — isto aqui é só para destacar as opções).
 */
export default function CheckersBoard({
  state,
  yourSeat,
  yourTurn,
  onMove,
  players,
}: {
  state: CheckersState
  yourSeat: number
  yourTurn: boolean
  onMove: (from: number, to: number) => void
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [selected, setSelected] = useState<number | null>(null)

  const moves = useMemo(() => (yourTurn ? legalMoves(state) : []), [state, yourTurn])
  const movesFromSelected = useMemo(
    () => moves.filter((m) => m.from === selected),
    [moves, selected],
  )
  const selectable = useMemo(() => new Set(moves.map((m) => m.from)), [moves])
  const targets = useMemo(
    () => new Map(movesFromSelected.map((m) => [m.to, m] as [number, CheckersMove])),
    [movesFromSelected],
  )

  // seat 0 vê suas peças (magenta) embaixo; seat 1 vê o tabuleiro girado
  const flipped = yourSeat === 1
  const displayOrder = useMemo(
    () => Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i)),
    [flipped],
  )

  function clickSquare(idx: number) {
    if (!yourTurn) return
    const piece = state.board[idx]
    if (piece && piece.p === yourSeat && selectable.has(idx)) {
      setSelected(idx === selected ? null : idx)
      return
    }
    if (selected !== null && targets.has(idx)) {
      onMove(selected, idx)
      setSelected(null)
    }
  }

  const me = players.find((p) => p.seat === yourSeat)
  const opponent = players.find((p) => p.seat !== yourSeat)
  const seatColor = (seat: number) => (seat === 0 ? 'bg-pop-magenta' : 'bg-pop-cyan')

  const PlayerTag = ({ p, pieces }: { p?: { name: string; seat: number; connected: boolean }; pieces: number }) =>
    p ? (
      <div className="flex items-center gap-2">
        <span className={`size-4 rounded-full ${seatColor(p.seat)}`} aria-hidden="true" />
        <span className="font-display font-bold">{p.name}</span>
        <span className="text-sm text-text-muted tabular-nums">({pieces} peças)</span>
        {!p.connected && (
          <span className="rounded-full bg-pop-orange/15 px-2 py-0.5 text-xs font-bold text-pop-orange">
            reconectando…
          </span>
        )}
        {state.turn === p.seat && (
          <span className="rounded-full bg-pop-yellow/15 px-2 py-0.5 text-xs font-bold text-pop-yellow">
            é a vez
          </span>
        )}
      </div>
    ) : null

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3">
        <PlayerTag p={opponent} pieces={opponent ? countPieces(state, opponent.seat as 0 | 1) : 0} />
      </div>

      <div
        className="grid aspect-square grid-cols-8 overflow-hidden rounded-card ring-2 ring-ink-700 select-none"
        role="grid"
        aria-label="Tabuleiro de damas"
      >
        {displayOrder.map((idx) => {
          const piece = state.board[idx]
          const dark = isDark(idx)
          const isSelected = selected === idx
          const isTarget = targets.has(idx)
          const canPick = yourTurn && piece?.p === yourSeat && selectable.has(idx)
          return (
            <button
              key={idx}
              role="gridcell"
              onClick={() => clickSquare(idx)}
              aria-label={`casa ${idx}`}
              className={`relative flex items-center justify-center ${
                dark ? 'bg-ink-800' : 'bg-cream/90'
              } ${isTarget || canPick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isTarget && (
                <span className="absolute inset-[30%] rounded-full bg-pop-green/50 ring-2 ring-pop-green" />
              )}
              {piece && (
                <span
                  className={`flex size-[78%] items-center justify-center rounded-full shadow-lg transition-transform ${seatColor(piece.p)} ${
                    isSelected ? 'scale-110 ring-4 ring-pop-yellow' : canPick ? 'ring-2 ring-cream/60' : ''
                  }`}
                >
                  <span className="flex size-[70%] items-center justify-center rounded-full border-2 border-ink-950/25 text-lg">
                    {piece.k && <span aria-label="dama">👑</span>}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <PlayerTag p={me} pieces={me ? countPieces(state, me.seat as 0 | 1) : 0} />
        <p className="text-sm font-semibold text-text-muted">
          {yourTurn ? (
            <span className="text-pop-green">Sua vez — capturas são obrigatórias!</span>
          ) : (
            'Aguardando o adversário…'
          )}
        </p>
      </div>
    </div>
  )
}
