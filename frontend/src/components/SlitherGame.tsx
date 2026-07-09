import { useEffect, useRef, useState } from 'react'
import type { CobraSnapshot } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Cobra Arena — render do snapshot do servidor com interpolação, câmera
 * seguindo a sua cobra. Mira: mova/toque a tela (aponta a cabeça). Boost:
 * clique/toque LONGO (segura) — gasta massa. Servidor é autoritativo.
 */

const INTERP = 95 // ms entre snapshots (broadcastEvery 2 × 45ms)
const VIEW_W = 1150 // largura de mundo visível (zoom)

interface Snap {
  t: number
  data: CobraSnapshot
}

export default function SlitherGame({
  snapshot,
  yourSeat,
}: {
  snapshot: CobraSnapshot
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevRef = useRef<Snap | null>(null)
  const curRef = useRef<Snap | null>(null)
  const aimRef = useRef(0)
  const boostRef = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef(0)
  const [hud, setHud] = useState<{ tempo: number; duracao: number; placar: CobraSnapshot['placar']; meuTam: number; vivo: boolean }>({
    tempo: 0,
    duracao: 150,
    placar: [],
    meuTam: 0,
    vivo: true,
  })

  // guarda os dois últimos snapshots para interpolar
  useEffect(() => {
    prevRef.current = curRef.current
    curRef.current = { t: performance.now(), data: snapshot }
  }, [snapshot])

  function enviaMira(force = false) {
    const now = performance.now()
    if (!force && now - lastSent.current < 55) return
    lastSent.current = now
    void emitAck('game:action', { action: { type: 'mira', angulo: aimRef.current } })
  }
  function enviaBoost(on: boolean) {
    if (boostRef.current === on) return
    boostRef.current = on
    void emitAck('game:action', { action: { type: 'boost', on } })
  }

  // loop de render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const render = () => {
      raf = requestAnimationFrame(render)
      const cur = curRef.current
      if (!cur) return
      const prev = prevRef.current ?? cur
      const dt = cur.t - prev.t || INTERP
      const alpha = Math.min(1, (performance.now() - cur.t) / dt)

      const W = canvas.width
      const H = canvas.height
      const scale = W / VIEW_W

      // acha minha cobra (para a câmera) — interpola a cabeça
      const meu = cur.data.snakes.find((s) => s.seat === yourSeat)
      const meuPrev = prev.data.snakes.find((s) => s.seat === yourSeat)
      let camX = 0
      let camY = 0
      if (meu && meu.corpo[0]) {
        const h = interp(meuPrev?.corpo[0], meu.corpo[0], alpha)
        camX = h.x
        camY = h.y
      }
      const toX = (wx: number) => (wx - camX) * scale + W / 2
      const toY = (wy: number) => (wy - camY) * scale + H / 2

      // fundo
      ctx.fillStyle = '#0a0f1e'
      ctx.fillRect(0, 0, W, H)
      // grade
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      const grid = 100 * scale
      const gx = ((W / 2 - camX * scale) % grid + grid) % grid
      const gy = ((H / 2 - camY * scale) % grid + grid) % grid
      ctx.beginPath()
      for (let x = gx; x < W; x += grid) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      for (let y = gy; y < H; y += grid) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()

      // borda da arena
      ctx.beginPath()
      ctx.arc(toX(0), toY(0), cur.data.raio * scale, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,80,120,0.5)'
      ctx.lineWidth = 6
      ctx.stroke()

      // comida
      for (const f of cur.data.food) {
        const sx = toX(f.x)
        const sy = toY(f.y)
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue
        ctx.beginPath()
        ctx.arc(sx, sy, f.r * scale, 0, Math.PI * 2)
        ctx.fillStyle = f.c
        ctx.shadowColor = f.c
        ctx.shadowBlur = 8
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // cobras
      for (const s of cur.data.snakes) {
        if (!s.vivo || s.corpo.length === 0) continue
        const sp = prev.data.snakes.find((p) => p.id === s.id)
        const pts = s.corpo.map((pt, i) => {
          const p = interp(sp?.corpo[i], pt, alpha)
          return { x: toX(p.x), y: toY(p.y) }
        })
        const eu = s.seat === yourSeat
        const lw = s.raio * 2 * scale
        // contorno
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        traca(ctx, pts, lw + 4, '#0a0f1e')
        if (s.boost) {
          ctx.shadowColor = s.cor
          ctx.shadowBlur = 16
        }
        traca(ctx, pts, lw, s.cor)
        ctx.shadowBlur = 0
        if (eu) traca(ctx, pts, lw, 'rgba(255,255,255,0.15)')
        // cabeça + olhos
        const head = pts[0]!
        const nxt = pts[1] ?? pts[0]!
        const fa = Math.atan2(head.y - nxt.y, head.x - nxt.x)
        const er = Math.max(2.2, s.raio * 0.45 * scale)
        for (const sgn of [-1, 1]) {
          const ex = head.x + Math.cos(fa + (sgn * Math.PI) / 2) * s.raio * 0.5 * scale + Math.cos(fa) * s.raio * 0.35 * scale
          const ey = head.y + Math.sin(fa + (sgn * Math.PI) / 2) * s.raio * 0.5 * scale + Math.sin(fa) * s.raio * 0.35 * scale
          ctx.beginPath()
          ctx.arc(ex, ey, er, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(ex + Math.cos(fa) * er * 0.4, ey + Math.sin(fa) * er * 0.4, er * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = '#0a0f1e'
          ctx.fill()
        }
        // nome
        if (!eu) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.font = 'bold 12px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(s.nome, head.x, head.y - s.raio * scale - 6)
        }
      }
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [yourSeat])

  // HUD a cada snapshot
  useEffect(() => {
    const meu = snapshot.snakes.find((s) => s.seat === yourSeat)
    setHud({
      tempo: snapshot.tempo,
      duracao: snapshot.duracao,
      placar: snapshot.placar,
      meuTam: meu?.tamanho ?? 0,
      vivo: meu?.vivo ?? false,
    })
  }, [snapshot, yourSeat])

  // entrada: mira pela posição do ponteiro; boost no toque/clique longo
  function aponta(e: React.PointerEvent) {
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    if (dx * dx + dy * dy > 25) {
      aimRef.current = Math.atan2(dy, dx)
      enviaMira()
    }
  }
  function onDown(e: React.PointerEvent) {
    aponta(e)
    enviaMira(true)
    holdTimer.current = setTimeout(() => enviaBoost(true), 200)
  }
  function onUp() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    enviaBoost(false)
  }

  const restante = Math.max(0, Math.ceil(hud.duracao - hud.tempo))

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-card ring-2 ring-ink-700">
        <canvas
          ref={canvasRef}
          width={900}
          height={620}
          className="block w-full touch-none"
          style={{ aspectRatio: '900 / 620' }}
          onPointerMove={aponta}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="rounded-field bg-ink-950/70 px-3 py-1.5 text-sm font-bold">
            🐍 <span className="tabular-nums text-pop-green">{hud.meuTam}</span>
            <span className="ml-3 tabular-nums text-pop-yellow">⏱️ {restante}s</span>
          </div>
          <div className="rounded-field bg-ink-950/70 px-3 py-1.5 text-xs">
            {hud.placar.slice(0, 5).map((p, i) => (
              <div key={i} className={`flex items-center gap-2 ${p.seat === yourSeat ? 'text-pop-cyan' : 'text-text-muted'}`}>
                <span className="w-4 font-display font-extrabold">{i + 1}</span>
                <span className="max-w-[90px] truncate">{p.nome}</span>
                <span className="ml-auto tabular-nums font-bold">{p.tamanho}</span>
              </div>
            ))}
          </div>
        </div>
        {!hud.vivo && !snapshot.finished && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-field bg-ink-950/80 px-5 py-3 font-display text-xl font-extrabold text-pop-magenta">
              💥 Renascendo…
            </p>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">
        Mova o dedo/mouse para virar a cobra. Segure (toque longo/clique) para ACELERAR — mas você perde massa!
      </p>
    </div>
  )
}

function interp(a: { x: number; y: number } | undefined, b: { x: number; y: number }, t: number) {
  if (!a) return b
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function traca(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, lw: number, cor: string) {
  if (pts.length < 2) {
    if (pts[0]) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, lw / 2, 0, Math.PI * 2)
      ctx.fillStyle = cor
      ctx.fill()
    }
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
  ctx.strokeStyle = cor
  ctx.lineWidth = lw
  ctx.stroke()
}
