/**
 * Engine 2D top-down do Mesa Pop — canvas puro, sem dependências.
 * Serve Esquadrão 42, Desvio Estelar e, depois, Come-Come, Invasores,
 * corrida e o co-op. Mantida deliberadamente pequena.
 */

export interface GameHost {
  /** avança a simulação (dt em segundos, já limitado) */
  update(dt: number): void
  /** desenha o frame */
  draw(ctx: CanvasRenderingContext2D): void
}

/** Loop com requestAnimationFrame e dt limitado (abas em segundo plano). */
export function startLoop(canvas: HTMLCanvasElement, host: GameHost): () => void {
  const ctx = canvas.getContext('2d')!
  let raf = 0
  let last = performance.now()
  let running = true

  const frame = (now: number) => {
    if (!running) return
    const dt = Math.min((now - last) / 1000, 1 / 20)
    last = now
    host.update(dt)
    ctx.save()
    host.draw(ctx)
    ctx.restore()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}

/** Entrada unificada: teclado (setas/WASD) + toque/arrasto no canvas. */
export class Input {
  private keys = new Set<string>()
  /** alvo do toque em coordenadas do jogo, ou null */
  pointer: { x: number; y: number } | null = null
  private cleanup: Array<() => void> = []

  attach(canvas: HTMLCanvasElement, toGameCoords: (px: number, py: number) => { x: number; y: number }) {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      this.keys.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    this.cleanup.push(() => window.removeEventListener('keydown', down))
    this.cleanup.push(() => window.removeEventListener('keyup', up))

    const updatePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * canvas.width
      const py = ((e.clientY - rect.top) / rect.height) * canvas.height
      this.pointer = toGameCoords(px, py)
    }
    const pointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      updatePointer(e)
    }
    const pointerMove = (e: PointerEvent) => {
      if (e.buttons > 0 || e.pointerType === 'touch') updatePointer(e)
    }
    const pointerUp = () => {
      this.pointer = null
    }
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
    })
  }

  detach() {
    for (const fn of this.cleanup) fn()
    this.cleanup = []
    this.keys.clear()
    this.pointer = null
  }

  /** vetor de direção -1..1 combinando teclado */
  axis(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1
    return { x, y }
  }

  pressed(key: string): boolean {
    return this.keys.has(key.toLowerCase())
  }
}

export interface Vec {
  x: number
  y: number
}

export function circleHit(a: Vec & { r: number }, b: Vec & { r: number }): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const rr = a.r + b.r
  return dx * dx + dy * dy <= rr * rr
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
export const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** Fundo de estrelas com N camadas de parallax rolando para baixo. */
export class Starfield {
  private stars: Array<{ x: number; y: number; layer: number }> = []
  constructor(
    private w: number,
    private h: number,
    count = 90,
  ) {
    for (let i = 0; i < count; i++) {
      this.stars.push({ x: rand(0, w), y: rand(0, h), layer: 1 + Math.floor(rand(0, 3)) })
    }
  }
  update(dt: number, speed = 60) {
    for (const s of this.stars) {
      s.y += speed * s.layer * 0.5 * dt
      if (s.y > this.h) {
        s.y = -2
        s.x = rand(0, this.w)
      }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const s of this.stars) {
      ctx.globalAlpha = 0.25 + s.layer * 0.22
      ctx.fillStyle = '#F4EFFF'
      ctx.fillRect(s.x, s.y, s.layer * 0.9, s.layer * 0.9)
    }
    ctx.globalAlpha = 1
  }
}

/** Partículas simples para explosões e rastros. */
export interface Particle extends Vec {
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export class Particles {
  list: Particle[] = []
  burst(x: number, y: number, color: string, count = 14, speed = 160) {
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2)
      const v = rand(speed * 0.3, speed)
      this.list.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        life: rand(0.25, 0.6),
        maxLife: 0.6,
        color,
        size: rand(1.5, 3.5),
      })
    }
  }
  update(dt: number) {
    for (const p of this.list) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.list = this.list.filter((p) => p.life > 0)
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }
}
