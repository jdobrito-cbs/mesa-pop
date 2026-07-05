import { useState } from 'react'
import { canPlayOnView, type OneAction, type OneCard, type OneColor, type OneView } from '@mesapop/shared'

const COLOR_STYLE: Record<string, { bg: string; name: string }> = {
  r: { bg: 'bg-pop-magenta', name: 'Magenta' },
  y: { bg: 'bg-pop-yellow', name: 'Amarelo' },
  g: { bg: 'bg-pop-green', name: 'Verde' },
  b: { bg: 'bg-pop-cyan', name: 'Ciano' },
}

const VALUE_LABEL: Record<string, string> = {
  skip: '⊘',
  rev: '⇄',
  '+2': '+2',
  wild: '★',
  '+4': '+4',
}

function Card({
  card,
  big = false,
  raised = false,
}: {
  card: OneCard
  big?: boolean
  raised?: boolean
}) {
  const size = big ? 'h-32 w-22 text-4xl' : 'h-20 w-14 text-xl'
  const label = VALUE_LABEL[card.v] ?? card.v
  if (card.c === 'w') {
    return (
      <span
        className={`${size} inline-flex items-center justify-center rounded-xl bg-ink-950 font-display font-extrabold text-cream ring-2 ring-cream/40 ${raised ? '-translate-y-2' : ''}`}
        style={{
          backgroundImage:
            'conic-gradient(from 45deg, #F252C1 0 25%, #FFC53D 0 50%, #55E07F 0 75%, #33E0D6 0 100%)',
        }}
      >
        <span className="rounded-lg bg-ink-950/80 px-2 py-1">{label}</span>
      </span>
    )
  }
  const style = COLOR_STYLE[card.c]!
  return (
    <span
      className={`${size} inline-flex items-center justify-center rounded-xl ${style.bg} font-display font-extrabold text-ink-950 ring-2 ring-ink-950/20 ${raised ? '-translate-y-2' : ''}`}
    >
      {label}
    </span>
  )
}

/** Mesa do One. `yourSeat === -1` = espectador. Servidor valida tudo. */
export default function OneTable({
  view,
  yourSeat,
  players,
  onAction,
}: {
  view: OneView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onAction: (action: OneAction) => void
}) {
  const [wildPick, setWildPick] = useState<OneCard | null>(null)
  const yourTurn = yourSeat >= 0 && view.turn === yourSeat

  function clickCard(card: OneCard) {
    if (!yourTurn) return
    if (card.c === 'w') {
      setWildPick(card)
      return
    }
    onAction({ type: 'play', card })
  }

  const bySeat = (seat: number) => players.find((p) => p.seat === seat)
  const others = players.filter((p) => p.seat !== yourSeat)

  return (
    <div className="flex flex-col gap-4">
      {/* adversários + direção */}
      <div className="flex flex-wrap items-center gap-2">
        {others.map((p) => (
          <div
            key={p.seat}
            className={`card flex items-center gap-2 px-3 py-2 ${view.turn === p.seat ? 'ring-2 ring-pop-yellow' : ''}`}
          >
            <span className="text-sm font-bold">{p.name}</span>
            <span className="rounded-full bg-ink-900 px-2 py-0.5 text-xs font-bold text-text-muted">
              {view.handCounts[p.seat]} cartas
            </span>
            {!p.connected && <span className="text-xs text-pop-orange">caiu</span>}
          </div>
        ))}
        <span className="ml-auto text-2xl" title="direção" aria-label="direção">
          {view.direction === 1 ? '↻' : '↺'}
        </span>
      </div>

      {/* centro: descarte + monte */}
      <div className="card flex items-center justify-center gap-8 p-6">
        <div className="text-center">
          <Card card={view.top} big />
          <p className="mt-2 text-xs font-bold tracking-wide text-text-muted uppercase">
            cor ativa:{' '}
            <span className={`inline-block size-3 rounded-full align-middle ${COLOR_STYLE[view.color]!.bg}`} />
          </p>
        </div>
        <button
          onClick={() => yourTurn && onAction({ type: 'draw' })}
          disabled={!yourTurn || !!view.drawnPlayable}
          className="btn-pop flex h-32 w-22 flex-col items-center justify-center rounded-xl bg-ink-900 ring-2 ring-ink-700 hover:ring-pop-purple disabled:opacity-50"
          aria-label="Comprar carta"
        >
          <span className="text-3xl" aria-hidden="true">🂠</span>
          <span className="mt-1 text-xs font-bold text-text-muted">Comprar</span>
          <span className="text-[10px] text-text-muted">{view.drawPileCount} no monte</span>
        </button>
      </div>

      {/* comprada jogável: decidir */}
      {yourTurn && view.drawnPlayable && (
        <div className="card flex items-center gap-3 p-4">
          <Card card={view.drawnPlayable} />
          <span className="text-sm text-text-muted">A carta comprada serve!</span>
          <button
            onClick={() =>
              view.drawnPlayable!.c === 'w'
                ? setWildPick(view.drawnPlayable)
                : onAction({ type: 'play', card: view.drawnPlayable! })
            }
            className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-2 text-sm text-white"
          >
            Jogar agora
          </button>
          <button
            onClick={() => onAction({ type: 'keep' })}
            className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
          >
            Guardar
          </button>
        </div>
      )}

      {/* sua mão */}
      {yourSeat >= 0 ? (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Sua mão ({view.yourHand.length})</p>
            {yourTurn ? (
              <span className="rounded-full bg-pop-yellow/15 px-3 py-1 text-xs font-bold text-pop-yellow">
                Sua vez!
              </span>
            ) : (
              <span className="text-xs text-text-muted">
                vez de {bySeat(view.turn)?.name ?? '…'}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.yourHand.map((card, i) => {
              const playable = yourTurn && !view.drawnPlayable && canPlayOnView(view, card)
              return (
                <button
                  key={`${card.c}${card.v}${i}`}
                  onClick={() => playable && clickCard(card)}
                  disabled={!playable}
                  className={`transition ${playable ? 'cursor-pointer hover:-translate-y-2' : 'opacity-60'}`}
                  aria-label={`carta ${card.c} ${card.v}`}
                >
                  <Card card={card} raised={false} />
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-text-muted">
          👀 Você está assistindo — as cartas dos jogadores ficam escondidas.
        </p>
      )}

      {/* escolha de cor do curinga */}
      {wildPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4">
          <div className="card p-6 text-center">
            <p className="font-display text-lg font-bold">Escolha a cor</p>
            <div className="mt-4 flex gap-3">
              {(['r', 'y', 'g', 'b'] as OneColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onAction({ type: 'play', card: wildPick, chooseColor: c })
                    setWildPick(null)
                  }}
                  className={`btn-pop size-14 rounded-2xl ${COLOR_STYLE[c]!.bg}`}
                  aria-label={COLOR_STYLE[c]!.name}
                />
              ))}
            </div>
            <button
              onClick={() => setWildPick(null)}
              className="btn-pop mt-4 px-4 py-1.5 text-sm ring-1 ring-ink-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
