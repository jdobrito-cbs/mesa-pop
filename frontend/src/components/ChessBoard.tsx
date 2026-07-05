import { useMemo, useState } from 'react'
import {
  chessStatus,
  colOf,
  legalChessMoves,
  rowOf,
  type ChessMove,
  type ChessState,
} from '@mesapop/shared'

/** glifos por cor (peças cheias para os dois lados, coloridas por CSS) */
const GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
const PROMO: Array<{ t: 'q' | 'r' | 'b' | 'n'; label: string }> = [
  { t: 'q', label: 'Dama' },
  { t: 'r', label: 'Torre' },
  { t: 'b', label: 'Bispo' },
  { t: 'n', label: 'Cavalo' },
]

/**
 * Tabuleiro de Xadrez. O estado vem do servidor; os lances legais são
 * calculados localmente com a MESMA lógica compartilhada (o servidor
 * revalida tudo — isto aqui é só para destacar as opções).
 */
export default function ChessBoard({
  state,
  yourSeat,
  players,
  onMove,
}: {
  state: ChessState
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onMove: (move: ChessMove) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [promoting, setPromoting] = useState<ChessMove | null>(null)

  const yourTurn = yourSeat === state.turn
  const status = useMemo(() => chessStatus(state), [state])
  const movesFromSelected = useMemo(
    () => (selected !== null && yourTurn ? legalChessMoves(state, selected) : []),
    [state, selected, yourTurn],
  )
  const targets = useMemo(() => new Set(movesFromSelected.map((m) => m.to)), [movesFromSelected])

  // seat 0 (brancas) vê suas peças embaixo; seat 1 vê o tabuleiro girado
  const flipped = yourSeat === 1
  const displayOrder = useMemo(
    () => Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i)),
    [flipped],
  )

  function clickSquare(idx: number) {
    if (!yourTurn || status.kind !== 'playing') return
    const piece = state.board[idx]
    if (piece && piece.c === yourSeat) {
      setSelected(idx === selected ? null : idx)
      return
    }
    if (selected !== null && targets.has(idx)) {
      const moving = state.board[selected]
      const lastRow = yourSeat === 0 ? 0 : 7
      if (moving?.t === 'p' && rowOf(idx) === lastRow) {
        setPromoting({ from: selected, to: idx }) // escolhe a peça da coroação
      } else {
        onMove({ from: selected, to: idx })
      }
      setSelected(null)
    }
  }

  const me = players.find((p) => p.seat === yourSeat)
  const opponent = players.find((p) => p.seat !== yourSeat)
  const captured = useMemo(() => {
    // material fora do tabuleiro (aproximação: conta o que falta de cada lado)
    const count = (c: 0 | 1) => state.board.filter((p) => p?.c === c).length
    return { 0: 16 - count(0), 1: 16 - count(1) }
  }, [state])

  const PlayerTag = ({ p }: { p?: { name: string; seat: number; connected: boolean } }) =>
    p ? (
      <div className="flex items-center gap-2">
        <span
          className={`flex size-5 items-center justify-center rounded-full text-xs ${p.seat === 0 ? 'bg-cream text-ink-950' : 'bg-ink-950 text-cream ring-1 ring-ink-700'}`}
          aria-hidden="true"
        >
          ♞
        </span>
        <span className="font-display font-bold">{p.name}</span>
        <span className="text-xs text-text-muted">
          {p.seat === 0 ? 'brancas' : 'pretas'} · {captured[p.seat === 0 ? 1 : 0]} capturadas
        </span>
        {!p.connected && (
          <span className="rounded-full bg-pop-orange/15 px-2 py-0.5 text-xs font-bold text-pop-orange">
            reconectando…
          </span>
        )}
        {status.kind === 'playing' && state.turn === p.seat && (
          <span className="rounded-full bg-pop-yellow/15 px-2 py-0.5 text-xs font-bold text-pop-yellow">
            é a vez
          </span>
        )}
      </div>
    ) : null

  const files = flipped ? [...'hgfedcba'] : [...'abcdefgh']

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <PlayerTag p={opponent} />
        {status.kind === 'playing' && status.inCheck && (
          <span className="animate-pulse rounded-full bg-pop-magenta/20 px-3 py-1 text-xs font-extrabold text-pop-magenta uppercase">
            xeque!
          </span>
        )}
      </div>

      <div
        className="relative grid aspect-square grid-cols-8 overflow-hidden rounded-card ring-2 ring-ink-700 select-none"
        role="grid"
        aria-label="Tabuleiro de xadrez"
      >
        {displayOrder.map((idx) => {
          const piece = state.board[idx]
          const light = (rowOf(idx) + colOf(idx)) % 2 === 0
          const isSelected = selected === idx
          const isTarget = targets.has(idx)
          const isLastMove = state.lastMove !== null && (state.lastMove.from === idx || state.lastMove.to === idx)
          const canPick = yourTurn && status.kind === 'playing' && piece?.c === yourSeat
          return (
            <button
              key={idx}
              role="gridcell"
              onClick={() => clickSquare(idx)}
              aria-label={`casa ${files[colOf(flipped ? 63 - idx : idx) % 8]}${8 - rowOf(idx)}`}
              className={`relative flex items-center justify-center ${
                light ? 'bg-cream/90' : 'bg-pop-purple/40'
              } ${isTarget || canPick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isLastMove && <span className="absolute inset-0 bg-pop-yellow/25" />}
              {isSelected && <span className="absolute inset-0 bg-pop-cyan/30 ring-2 ring-pop-cyan ring-inset" />}
              {isTarget && (
                <span
                  className={
                    piece
                      ? 'absolute inset-0 ring-4 ring-pop-green/80 ring-inset'
                      : 'absolute inset-[36%] rounded-full bg-pop-green/60'
                  }
                />
              )}
              {piece && (
                <span
                  className={`relative text-[5.2vw] leading-none sm:text-4xl ${
                    piece.c === 0
                      ? 'text-cream drop-shadow-[0_2px_2px_rgba(20,14,38,0.9)]'
                      : 'text-ink-950 drop-shadow-[0_1px_1px_rgba(244,239,255,0.35)]'
                  }`}
                >
                  {GLYPH[piece.t]}
                </span>
              )}
            </button>
          )
        })}

        {/* escolha da promoção */}
        {promoting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950/80">
            <div className="card p-5 text-center">
              <p className="font-display font-bold">Coroar como:</p>
              <div className="mt-3 flex gap-2">
                {PROMO.map(({ t, label }) => (
                  <button
                    key={t}
                    onClick={() => {
                      onMove({ ...promoting, promotion: t })
                      setPromoting(null)
                    }}
                    className="btn-pop flex flex-col items-center px-4 py-2 ring-2 ring-ink-700 hover:ring-pop-yellow"
                  >
                    <span className="text-3xl">{GLYPH[t]}</span>
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <PlayerTag p={me} />
        <p className="text-sm font-semibold text-text-muted">
          {yourSeat < 0
            ? 'Assistindo ao vivo 👀'
            : status.kind !== 'playing'
              ? 'Partida encerrada'
              : yourTurn
                ? <span className="text-pop-green">Sua vez!</span>
                : 'Aguardando o adversário…'}
        </p>
      </div>
    </div>
  )
}
