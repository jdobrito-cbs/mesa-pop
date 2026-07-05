import { useEffect, useRef, useState } from 'react'
import { COOP_H, COOP_W, type CoopAction, type CoopSnapshot } from '@mesapop/shared'
import { startLoop } from '../engine/core'
import { CoopClientView, type CoopHud } from '../games/coopClient'
import { emitAck } from '../lib/socket'

/** Esquadrão 42 Co-op — canvas + HUD da dupla + botões de toque. */
export default function CoopGame({
  snapshot,
  yourSeat,
  players,
}: {
  snapshot: CoopSnapshot
  yourSeat: number
  players: { name: string; seat: number }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<CoopClientView | null>(null)
  const [hud, setHud] = useState<CoopHud | null>(null)

  // instancia o cliente uma vez
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const view = new CoopClientView(
      yourSeat,
      (action: CoopAction) => void emitAck('game:action', { action }),
      setHud,
    )
    viewRef.current = view
    if (yourSeat >= 0) view.input.attach(canvas, (px, py) => ({ x: px, y: py }))
    const stop = startLoop(canvas, view)
    return () => {
      stop()
      view.input.detach()
      viewRef.current = null
    }
  }, [yourSeat])

  // snapshots do servidor alimentam o cliente
  useEffect(() => {
    viewRef.current?.pushSnapshot(snapshot)
  }, [snapshot])

  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Piloto ${seat + 1}`
  const mine = hud?.planes[yourSeat]
  const teamScore = hud ? hud.planes.reduce((s, p) => s + p.score, 0) : 0

  return (
    <div className="relative mx-auto w-full max-w-md">
      <canvas
        ref={canvasRef}
        width={COOP_W}
        height={COOP_H}
        className="block w-full touch-none rounded-card ring-2 ring-ink-700"
        aria-label="Esquadrão 42 Co-op"
      />

      {/* HUD da dupla */}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 font-display text-xs font-bold">
          <div className="flex flex-col gap-1">
            {hud.planes.map((p) => (
              <span
                key={p.seat}
                className={`rounded-full bg-ink-950/70 px-3 py-1 ${p.seat === yourSeat ? 'text-pop-purple' : 'text-pop-cyan'}`}
              >
                {nameOf(p.seat)}
                {p.seat === yourSeat ? ' (você)' : ''} ·{' '}
                {hud.mode === 'lado-a-lado'
                  ? `${'♥'.repeat(Math.max(p.lives, 0))} ${p.score}pts`
                  : p.downed
                    ? '⛔ derrubado'
                    : '✈ voando'}
              </span>
            ))}
          </div>
          <span className="rounded-full bg-ink-950/70 px-3 py-1 text-pop-yellow tabular-nums">
            {hud.mode === 'juntos' ? `time ${teamScore} pts` : `${mine?.score ?? 0} pts`}
          </span>
        </div>
      )}

      {/* botões de toque */}
      {yourSeat >= 0 && mine?.alive && !mine.downed && !snapshot.finished && (
        <div className="absolute right-3 bottom-3 flex flex-col gap-2">
          <button
            aria-label="Loop"
            onPointerDown={(e) => {
              e.preventDefault()
              viewRef.current?.triggerLoop()
            }}
            className="flex size-14 flex-col items-center justify-center rounded-full bg-ink-950/75 font-display text-xl text-pop-cyan ring-2 ring-pop-cyan/60 backdrop-blur select-none active:scale-90"
          >
            <span aria-hidden="true">➰</span>
            <span className="text-[9px] font-bold uppercase">Loop</span>
          </button>
          <button
            aria-label="Bomba"
            onPointerDown={(e) => {
              e.preventDefault()
              viewRef.current?.triggerBomb()
            }}
            className={`flex size-14 flex-col items-center justify-center rounded-full bg-ink-950/75 font-display text-xl ring-2 backdrop-blur select-none ${
              mine.bombs > 0 ? 'text-pop-yellow ring-pop-yellow/60 active:scale-90' : 'text-text-muted/50 ring-ink-700 opacity-60'
            }`}
          >
            <span aria-hidden="true">✹</span>
            <span className="text-[9px] font-bold uppercase">{mine.bombs}× Bomba</span>
          </button>
        </div>
      )}

      {/* arma atual */}
      {mine && mine.alive && !mine.downed && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-ink-950/70 px-3 py-1 font-display text-xs font-bold text-pop-cyan">
          {mine.weapon}
          {mine.weapon !== 'reto' ? ` ×${mine.ammo}` : ''}
        </div>
      )}
    </div>
  )
}
