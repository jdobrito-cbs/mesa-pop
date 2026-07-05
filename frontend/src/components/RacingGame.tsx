import { useEffect, useRef, useState } from 'react'
import { RACE_H, RACE_W, type CarInputState, type RacingSnapshot } from '@mesapop/shared'
import { startLoop } from '../engine/core'
import { RacingClientView, type RaceHud } from '../games/racingClient'
import { emitAck } from '../lib/socket'

const ordinal = (n: number) => `${n}º`

/** Corrida Pop — canvas paisagem + HUD + controles de toque. */
export default function RacingGame({
  snapshot,
  yourSeat,
  players,
}: {
  snapshot: RacingSnapshot
  yourSeat: number
  players: { name: string; seat: number }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<RacingClientView | null>(null)
  const [hud, setHud] = useState<RaceHud | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const view = new RacingClientView(
      yourSeat,
      (input: CarInputState) => void emitAck('game:action', { action: { type: 'input', ...input } }),
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

  useEffect(() => {
    viewRef.current?.pushSnapshot(snapshot)
  }, [snapshot])

  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Piloto ${seat + 1}`
  const touchBtn = (key: 'left' | 'right' | 'drift' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      if (viewRef.current) viewRef.current.touch[key] = true
    },
    onPointerUp: () => {
      if (viewRef.current) viewRef.current.touch[key] = false
    },
    onPointerLeave: () => {
      if (viewRef.current) viewRef.current.touch[key] = false
    },
  })

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <canvas
        ref={canvasRef}
        width={RACE_W}
        height={RACE_H}
        className="block w-full touch-none rounded-card ring-2 ring-ink-700"
        aria-label="Corrida Pop"
      />

      {/* HUD */}
      {hud && hud.phase !== 'finished' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-display text-sm font-bold">
          <span className="rounded-full bg-ink-950/70 px-3 py-1 text-pop-yellow tabular-nums">
            {hud.vehicle === 'moto' ? '🏍️' : '🏎️'} volta {hud.lap}/{hud.totalLaps}
          </span>
          <span className="mr-36 rounded-full bg-ink-950/70 px-3 py-1 text-pop-cyan tabular-nums">
            {ordinal(hud.position)} de {hud.players}
          </span>
        </div>
      )}
      {/* velocímetro */}
      {hud && hud.phase === 'racing' && (
        <div className="pointer-events-none absolute right-3 bottom-3 hidden rounded-2xl bg-ink-950/70 px-4 py-2 text-right ring-1 ring-ink-700 lg:block">
          <p className="font-display text-3xl font-extrabold text-cream tabular-nums">{hud.speed}</p>
          <p className="-mt-1 text-[10px] font-bold tracking-widest text-text-muted uppercase">km/h</p>
        </div>
      )}
      {/* barra de boost — canto esquerdo para não cobrir o veículo */}
      {hud && hud.phase === 'racing' && (
        <div className="pointer-events-none absolute bottom-20 left-3 w-40 lg:bottom-4 lg:left-4">
          <p className="mb-0.5 font-display text-[10px] font-extrabold tracking-widest text-cream/80 uppercase drop-shadow">
            boost (derrape p/ carregar!)
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-ink-950/70 ring-1 ring-ink-700">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-pop-orange to-pop-yellow transition-all"
              style={{ width: `${(hud.boost * 100).toFixed(0)}%` }}
            />
          </div>
        </div>
      )}

      {/* contagem regressiva */}
      {hud?.phase === 'countdown' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-float font-display text-8xl font-extrabold text-pop-yellow drop-shadow-[0_0_24px_rgba(255,197,61,0.9)]">
            {Math.ceil(hud.countdown)}
          </span>
        </div>
      )}

      {/* resultado */}
      {hud?.phase === 'finished' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-card bg-ink-950/85">
          <div className="card p-6 text-center">
            <p className="text-5xl" aria-hidden="true">🏁</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">Resultado</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {hud.finishOrder.map((seat, i) => (
                <div
                  key={seat}
                  className={`flex items-center gap-3 rounded-field px-4 py-1.5 text-sm ring-1 ${
                    seat === hud.yourSeat ? 'bg-pop-yellow/15 ring-pop-yellow/50' : 'bg-ink-900 ring-ink-700'
                  }`}
                >
                  <span className={`font-display font-extrabold ${i === 0 ? 'text-pop-yellow' : 'text-text-muted'}`}>
                    {i === 0 ? '🏆' : ordinal(i + 1)}
                  </span>
                  <span className="font-bold">
                    {nameOf(seat)}
                    {seat === hud.yourSeat ? ' (você)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* controles de toque (celular/tablet) */}
      {yourSeat >= 0 && hud?.phase === 'racing' && (
        <>
          <div className="absolute bottom-3 left-3 flex gap-2 lg:hidden">
            <button {...touchBtn('left')} aria-label="Virar à esquerda" className="flex size-14 items-center justify-center rounded-full bg-ink-950/75 text-2xl text-cream ring-2 ring-ink-700 backdrop-blur select-none active:scale-90">◀</button>
            <button {...touchBtn('right')} aria-label="Virar à direita" className="flex size-14 items-center justify-center rounded-full bg-ink-950/75 text-2xl text-cream ring-2 ring-ink-700 backdrop-blur select-none active:scale-90">▶</button>
          </div>
          <div className="absolute right-3 bottom-3 flex gap-2 lg:hidden">
            <button {...touchBtn('drift')} aria-label="Derrapar" className="flex size-14 flex-col items-center justify-center rounded-full bg-ink-950/75 font-display text-lg text-pop-cyan ring-2 ring-pop-cyan/60 backdrop-blur select-none active:scale-90">
              <span aria-hidden="true">🛞</span>
              <span className="text-[8px] font-bold uppercase">Drift</span>
            </button>
            <button {...touchBtn('boost')} aria-label="Boost" className="flex size-14 flex-col items-center justify-center rounded-full bg-ink-950/75 font-display text-lg text-pop-yellow ring-2 ring-pop-yellow/60 backdrop-blur select-none active:scale-90">
              <span aria-hidden="true">🔥</span>
              <span className="text-[8px] font-bold uppercase">Boost</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
