import { useEffect, useMemo, useRef, useState } from 'react'
import {
  chessStatus,
  colOf,
  legalChessMoves,
  rowOf,
  type ChessColor,
  type ChessMove,
  type ChessState,
  type PieceType,
} from '@mesapop/shared'
import PieceSvg from './ChessPieces'

const PROMO: Array<{ t: 'q' | 'r' | 'b' | 'n'; label: string }> = [
  { t: 'q', label: 'Dama' },
  { t: 'r', label: 'Torre' },
  { t: 'b', label: 'Bispo' },
  { t: 'n', label: 'Cavalo' },
]

/** animação de deslocamento por personagem */
const MOVE_ANIM: Record<PieceType, string> = {
  p: 'march', // soldadinho marchando
  n: 'gallop', // cavaleiro galopando
  b: 'staffwalk', // bispo no cajado
  r: 'drag', // torre se arrastando
  q: 'glide', // rainha deslizando
  k: 'royal', // rei em passo solene
}

/**
 * Peça "viva" da camada animada: mantém identidade entre estados para o
 * CSS transicionar o translate (a peça ANDA de casa em casa).
 */
interface Sprite {
  id: number
  t: PieceType
  c: ChessColor
  idx: number
  anim: string | null
  animKey: number
  dying: boolean
}

interface Effect {
  key: number
  idx: number
  from?: number
  kind: 'burst' | 'trail-rook' | 'trail-queen'
}

let effectSeq = 1

function buildSprites(state: ChessState): Sprite[] {
  const out: Sprite[] = []
  state.board.forEach((p, idx) => {
    if (p) out.push({ id: effectSeq++, t: p.t, c: p.c, idx, anim: null, animKey: 0, dying: false })
  })
  return out
}

interface Advance {
  sprites: Sprite[]
  capturedAt: number | null
  trails: Array<{ from: number; to: number; kind: 'trail-rook' | 'trail-queen' }>
}

/** aplica o último lance aos sprites; null = não bateu com o estado (rebuild) */
function advanceSprites(prev: Sprite[], state: ChessState): Advance | null {
  const move = state.lastMove
  if (!move) return null
  const alive = prev.filter((s) => !s.dying)
  const at = new Map(alive.map((s) => [s.idx, s]))
  const mover = at.get(move.from)
  if (!mover) return null

  let capturedAt: number | null = null
  let captured = at.get(move.to) ?? null
  if (captured) capturedAt = move.to
  else if (mover.t === 'p' && colOf(move.to) !== colOf(move.from)) {
    // en passant: o peão capturado não está na casa de destino
    const epIdx = rowOf(move.from) * 8 + colOf(move.to)
    captured = at.get(epIdx) ?? null
    if (captured) capturedAt = epIdx
  }

  // roque: a torre acompanha (com rastro)
  let rookFrom = -1
  let rookTo = -1
  if (mover.t === 'k' && Math.abs(colOf(move.to) - colOf(move.from)) === 2) {
    const home = mover.c === 0 ? 56 : 0
    rookFrom = move.to === home + 6 ? home + 7 : home
    rookTo = move.to === home + 6 ? home + 5 : home + 3
  }

  const landed = state.board[move.to]
  if (!landed) return null

  const trails: Advance['trails'] = []
  if (mover.t === 'r') trails.push({ from: move.from, to: move.to, kind: 'trail-rook' })
  if (mover.t === 'q') trails.push({ from: move.from, to: move.to, kind: 'trail-queen' })
  if (rookFrom >= 0) trails.push({ from: rookFrom, to: rookTo, kind: 'trail-rook' })

  const sprites = prev.map((s): Sprite => {
    if (s.dying) return s
    if (s === mover) {
      const promoted = landed.t !== s.t
      return {
        ...s,
        idx: move.to,
        t: landed.t,
        anim: promoted ? 'spawn' : MOVE_ANIM[s.t],
        animKey: s.animKey + 1,
      }
    }
    if (captured && s === captured) return { ...s, dying: true, anim: 'die', animKey: s.animKey + 1 }
    if (s.idx === rookFrom) return { ...s, idx: rookTo, anim: 'drag', animKey: s.animKey + 1 }
    return s
  })

  // confere com o tabuleiro oficial (reconexão/rotação → rebuild sem animar)
  const check = new Map(sprites.filter((s) => !s.dying).map((s) => [s.idx, s]))
  for (let i = 0; i < 64; i++) {
    const p = state.board[i]
    const s = check.get(i)
    if ((p && (!s || s.t !== p.t || s.c !== p.c)) || (!p && s)) return null
  }
  return { sprites, capturedAt, trails }
}

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
  const [sprites, setSprites] = useState<Sprite[]>(() => buildSprites(state))
  const [effects, setEffects] = useState<Effect[]>([])
  const lastState = useRef<ChessState>(state)

  function pushEffect(e: Omit<Effect, 'key'>, ttl: number) {
    const eff = { ...e, key: effectSeq++ }
    setEffects((cur) => [...cur, eff])
    setTimeout(() => setEffects((cur) => cur.filter((x) => x.key !== eff.key)), ttl)
  }

  // reconcilia a camada animada a cada estado novo do servidor
  useEffect(() => {
    if (lastState.current === state) return
    lastState.current = state
    setSprites((prev) => {
      const step = advanceSprites(prev, state)
      if (!step) return buildSprites(state)
      if (step.capturedAt !== null) pushEffect({ kind: 'burst', idx: step.capturedAt }, 600)
      for (const t of step.trails) pushEffect({ kind: t.kind, idx: t.to, from: t.from }, 750)
      // remove os capturados depois da animação de queda
      setTimeout(() => setSprites((cur) => cur.filter((s) => !s.dying)), 550)
      return step.sprites
    })
  }, [state])

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
  const dispPos = (idx: number) => {
    const d = flipped ? 63 - idx : idx
    return { col: d % 8, row: Math.floor(d / 8) }
  }

  const checkedKing =
    status.kind === 'playing' && status.inCheck
      ? sprites.find((s) => !s.dying && s.t === 'k' && s.c === state.turn)?.id
      : undefined

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
    const count = (c: 0 | 1) => state.board.filter((p) => p?.c === c).length
    return { 0: 16 - count(0), 1: 16 - count(1) }
  }, [state])

  const PlayerTag = ({ p }: { p?: { name: string; seat: number; connected: boolean } }) =>
    p ? (
      <div className="flex items-center gap-2">
        <span className="size-6" aria-hidden="true">
          <PieceSvg t="k" c={p.seat as ChessColor} className="size-6" />
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

  const files = [...'abcdefgh']

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

      {/* moldura do tabuleiro */}
      <div className="rounded-card bg-gradient-to-br from-pop-purple/40 via-ink-700 to-ink-800 p-1.5 shadow-2xl shadow-ink-950/60 ring-2 ring-ink-700 sm:p-2">
        <div className="relative overflow-hidden rounded-xl select-none">
          <div className="grid aspect-square grid-cols-8" role="grid" aria-label="Tabuleiro de xadrez">
            {displayOrder.map((idx, i) => {
              const light = (rowOf(idx) + colOf(idx)) % 2 === 0
              const isSelected = selected === idx
              const isTarget = targets.has(idx)
              const hasPiece = !!state.board[idx]
              const isLastMove =
                state.lastMove !== null && (state.lastMove.from === idx || state.lastMove.to === idx)
              const canPick = yourTurn && status.kind === 'playing' && state.board[idx]?.c === yourSeat
              const dCol = i % 8
              const dRow = Math.floor(i / 8)
              return (
                <button
                  key={idx}
                  role="gridcell"
                  onClick={() => clickSquare(idx)}
                  aria-label={`casa ${files[colOf(idx)]}${8 - rowOf(idx)}`}
                  className={`relative flex items-center justify-center ${
                    light
                      ? 'bg-gradient-to-br from-cream to-cream/85'
                      : 'bg-gradient-to-br from-pop-purple/45 to-pop-purple/30'
                  } ${isTarget || canPick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {isLastMove && <span className="absolute inset-0 bg-pop-yellow/30" />}
                  {isSelected && (
                    <span className="absolute inset-0 bg-pop-cyan/25 ring-2 ring-pop-cyan ring-inset" />
                  )}
                  {isTarget && (
                    <span
                      className={
                        hasPiece
                          ? 'absolute inset-0 ring-4 ring-pop-green/80 ring-inset'
                          : 'chess-target-dot absolute inset-[36%] rounded-full bg-pop-green/60'
                      }
                    />
                  )}
                  {/* coordenadas discretas */}
                  {dCol === 0 && (
                    <span className={`absolute top-0.5 left-1 text-[9px] font-bold ${light ? 'text-ink-800/50' : 'text-cream/60'}`}>
                      {8 - rowOf(idx)}
                    </span>
                  )}
                  {dRow === 7 && (
                    <span className={`absolute right-1 bottom-0.5 text-[9px] font-bold ${light ? 'text-ink-800/50' : 'text-cream/60'}`}>
                      {files[colOf(idx)]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* rastros (torre se arrastando / brilho da rainha) */}
          {effects
            .filter((e) => e.kind !== 'burst' && e.from !== undefined)
            .map((e) => {
              const a = dispPos(e.from!)
              const b = dispPos(e.idx)
              const x1 = (a.col + 0.5) * 12.5
              const y1 = (a.row + 0.5) * 12.5
              const dx = (b.col - a.col) * 12.5
              const dy = (b.row - a.row) * 12.5
              const len = Math.hypot(dx, dy)
              const ang = (Math.atan2(dy, dx) * 180) / Math.PI
              return (
                <span
                  key={e.key}
                  className={`chess-trail ${e.kind}`}
                  style={{
                    left: `${x1}%`,
                    top: `calc(${y1}% - 2.5%)`,
                    width: `${len}%`,
                    transform: `rotate(${ang}deg)`,
                  }}
                />
              )
            })}

          {/* camada de peças ANIMADAS (desliza entre casas via transform) */}
          {sprites.map((sp) => {
            const { col, row } = dispPos(sp.idx)
            return (
              <div
                key={sp.id}
                className={`chess-piece ${sp.dying ? 'is-dying' : ''} ${checkedKing === sp.id ? 'chess-incheck' : ''}`}
                style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
              >
                <span key={sp.animKey} className={`chess-glyph flex size-full items-center justify-center ${sp.anim ? `anim-${sp.anim}` : ''}`}>
                  <span
                    className="chess-idle flex size-full items-center justify-center"
                    style={{ animationDelay: `${(sp.id % 7) * -0.45}s` }}
                  >
                    <PieceSvg t={sp.t} c={sp.c} className="size-[94%]" />
                  </span>
                </span>
              </div>
            )
          })}

          {/* estouro da captura */}
          {effects
            .filter((e) => e.kind === 'burst')
            .map((e) => {
              const { col, row } = dispPos(e.idx)
              return (
                <span
                  key={e.key}
                  className="chess-burst"
                  style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
                />
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
                      className="btn-pop flex flex-col items-center px-3 py-2 ring-2 ring-ink-700 hover:ring-pop-yellow"
                    >
                      <PieceSvg t={t} c={(yourSeat >= 0 ? yourSeat : 0) as ChessColor} className="size-12" />
                      <span className="text-xs font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
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
