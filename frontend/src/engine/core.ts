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
  /** posição do ponteiro SEM clique (hover) — para jogos de cursor */
  hover: { x: number; y: number } | null = null
  /** botão/toque pressionado agora? desde quando (ms epoch)? */
  isDown = false
  downAt = 0
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

    const coords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * canvas.width
      const py = ((e.clientY - rect.top) / rect.height) * canvas.height
      return toGameCoords(px, py)
    }
    const updatePointer = (e: PointerEvent) => {
      this.pointer = coords(e)
    }
    const pointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      this.isDown = true
      this.downAt = performance.now()
      this.hover = coords(e)
      updatePointer(e)
    }
    const pointerMove = (e: PointerEvent) => {
      this.hover = coords(e)
      if (e.buttons > 0 || e.pointerType === 'touch') updatePointer(e)
    }
    const pointerUp = () => {
      this.pointer = null
      this.isDown = false
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
    this.hover = null
    this.isDown = false
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

/** Fundo de estrelas em camadas de parallax, com cintilação. */
export class Starfield {
  private stars: Array<{ x: number; y: number; layer: number; phase: number }> = []
  private t = 0
  constructor(
    private w: number,
    private h: number,
    count = 90,
  ) {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rand(0, w),
        y: rand(0, h),
        layer: 1 + Math.floor(rand(0, 3)),
        phase: rand(0, Math.PI * 2),
      })
    }
  }
  update(dt: number, speed = 60) {
    this.t += dt
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
      const twinkle = 0.75 + 0.25 * Math.sin(this.t * 2.4 + s.phase)
      ctx.globalAlpha = (0.2 + s.layer * 0.22) * twinkle
      ctx.fillStyle = s.layer === 3 ? '#FFFFFF' : '#D8CFF2'
      const size = s.layer * 0.95
      ctx.beginPath()
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/** Desenha com glow (shadowBlur) e restaura o contexto. */
export function withGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  fn: () => void,
) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  fn()
  ctx.restore()
}

/** Tremor de tela com decaimento — aplicar offset no início do draw. */
export class ScreenShake {
  private power = 0
  kick(amount: number) {
    this.power = Math.min(this.power + amount, 18)
  }
  update(dt: number) {
    this.power = Math.max(0, this.power - dt * 26)
  }
  offset(): Vec {
    if (this.power <= 0) return { x: 0, y: 0 }
    return { x: rand(-this.power, this.power), y: rand(-this.power, this.power) }
  }
}

/** Textos flutuantes ("+100") subindo e sumindo. */
export class FloatingTexts {
  private list: Array<{ x: number; y: number; text: string; life: number; color: string; size: number }> = []
  add(x: number, y: number, text: string, color = '#FFC53D', size = 15) {
    this.list.push({ x, y, text, life: 0.9, color, size })
  }
  update(dt: number) {
    for (const t of this.list) {
      t.y -= 34 * dt
      t.life -= dt
    }
    this.list = this.list.filter((t) => t.life > 0)
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const t of this.list) {
      ctx.save()
      ctx.globalAlpha = Math.min(t.life / 0.35, 1)
      ctx.font = `800 ${t.size}px "Baloo 2 Variable", "Baloo 2", sans-serif`
      ctx.textAlign = 'center'
      ctx.shadowColor = t.color
      ctx.shadowBlur = 8
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
      ctx.restore()
    }
  }
}

/** Ondas de choque (anéis que expandem e somem) — explosões com peso. */
export class Shockwaves {
  private list: Array<{ x: number; y: number; r: number; maxR: number; life: number; color: string }> = []
  add(x: number, y: number, maxR = 60, color = '#FFC53D') {
    this.list.push({ x, y, r: 6, maxR, life: 1, color })
  }
  update(dt: number) {
    for (const w of this.list) {
      w.r += (w.maxR - w.r) * 10 * dt
      w.life -= dt * 2.6
    }
    this.list = this.list.filter((w) => w.life > 0)
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const w of this.list) {
      ctx.save()
      ctx.globalAlpha = w.life * 0.8
      ctx.strokeStyle = w.color
      ctx.lineWidth = 3 * w.life
      ctx.shadowColor = w.color
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
}

/** Nebulosas suaves à deriva — profundidade para fundos espaciais. */
export class Nebulas {
  private blobs: Array<{ x: number; y: number; r: number; color: string; vy: number }>
  constructor(
    private w: number,
    private h: number,
    colors: string[] = ['157,92,255', '51,224,214', '242,82,193'],
  ) {
    this.blobs = colors.map((c, i) => ({
      x: rand(0, w),
      y: (h / colors.length) * i + rand(-40, 40),
      r: rand(120, 210),
      color: c,
      vy: rand(6, 14),
    }))
  }
  update(dt: number) {
    for (const b of this.blobs) {
      b.y += b.vy * dt
      if (b.y - b.r > this.h) {
        b.y = -b.r
        b.x = rand(0, this.w)
      }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const b of this.blobs) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
      g.addColorStop(0, `rgba(${b.color},0.16)`)
      g.addColorStop(1, `rgba(${b.color},0)`)
      ctx.fillStyle = g
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)
    }
  }
}

/** Vinheta sutil nas bordas — acabamento de jogo mobile. */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(10,6,24,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
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
