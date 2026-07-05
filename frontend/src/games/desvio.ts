/**
 * Desvio Estelar — endless de DESVIO puro. Um toque e acabou.
 * Visual de jogo mobile: nebulosas, glow, rastros, shake e ondas de choque.
 */
import {
  circleHit,
  clamp,
  drawVignette,
  rand,
  withGlow,
  FloatingTexts,
  Input,
  Nebulas,
  Particles,
  ScreenShake,
  Shockwaves,
  Starfield,
  type GameHost,
} from '../engine/core'

export const DESVIO_W = 480
export const DESVIO_H = 640

interface Obstacle {
  kind: 'asteroid' | 'comet' | 'alien'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  spin: number
  angle: number
  seed: number
}

export interface DesvioCallbacks {
  onGameOver(points: number): void
  onHud(hud: { points: number; seconds: number }): void
}

export class DesvioGame implements GameHost {
  input = new Input()
  private stars = new Starfield(DESVIO_W, DESVIO_H, 110)
  private nebulas = new Nebulas(DESVIO_W, DESVIO_H)
  private particles = new Particles()
  private texts = new FloatingTexts()
  private waves = new Shockwaves()
  private shake = new ScreenShake()
  private ship = { x: DESVIO_W / 2, y: DESVIO_H - 90, r: 10, vx: 0 }
  private trail: Array<{ x: number; y: number; life: number }> = []
  private obstacles: Obstacle[] = []
  private time = 0
  private spawnTimer = 0
  private over = false
  private lastHud = -1
  private lastMilestone = 0

  constructor(private cb: DesvioCallbacks) {}

  get points() {
    return Math.floor(this.time) * 10
  }

  private spawn() {
    const roll = Math.random()
    const difficulty = Math.min(this.time / 60, 1)
    if (roll < 0.55) {
      const r = rand(12, 26 + difficulty * 10)
      this.obstacles.push({
        kind: 'asteroid',
        x: rand(r, DESVIO_W - r),
        y: -r * 2,
        vx: rand(-30, 30),
        vy: rand(80, 140) + difficulty * 120,
        r,
        spin: rand(-1.6, 1.6),
        angle: rand(0, Math.PI * 2),
        seed: rand(0, 10),
      })
    } else if (roll < 0.8) {
      const fromLeft = Math.random() < 0.5
      this.obstacles.push({
        kind: 'comet',
        x: fromLeft ? -20 : DESVIO_W + 20,
        y: rand(-40, DESVIO_H * 0.4),
        vx: (fromLeft ? 1 : -1) * rand(180, 260 + difficulty * 120),
        vy: rand(120, 200),
        r: 8,
        spin: 0,
        angle: 0,
        seed: rand(0, 10),
      })
    } else {
      this.obstacles.push({
        kind: 'alien',
        x: rand(30, DESVIO_W - 30),
        y: -24,
        vx: 0,
        vy: rand(70, 110) + difficulty * 80,
        r: 14,
        spin: rand(2, 4),
        angle: rand(0, Math.PI * 2),
        seed: rand(0, 10),
      })
    }
  }

  update(dt: number) {
    if (this.over) {
      // deixa os efeitos de morte respirarem
      this.particles.update(dt)
      this.waves.update(dt)
      this.shake.update(dt)
      this.texts.update(dt)
      return
    }
    this.time += dt
    this.stars.update(dt, 80 + this.time * 2)
    this.nebulas.update(dt)
    this.particles.update(dt)
    this.texts.update(dt)
    this.waves.update(dt)
    this.shake.update(dt)

    // controles: teclado ou arrastar o dedo/mouse
    const speed = 300
    const axis = this.input.axis()
    let dx = axis.x * speed * dt
    let dy = axis.y * speed * dt
    if (this.input.pointer) {
      const px = this.input.pointer.x - this.ship.x
      const py = this.input.pointer.y - this.ship.y
      const dist = Math.hypot(px, py)
      if (dist > 4) {
        const v = Math.min(speed * 1.2, dist * 10)
        dx += (px / dist) * v * dt
        dy += (py / dist) * v * dt
      }
    }
    this.ship.x = clamp(this.ship.x + dx, 14, DESVIO_W - 14)
    this.ship.y = clamp(this.ship.y + dy, 20, DESVIO_H - 20)
    this.ship.vx = dx / Math.max(dt, 0.001)

    // rastro do motor
    this.trail.push({ x: this.ship.x + rand(-1.5, 1.5), y: this.ship.y + 14, life: 0.35 })
    for (const t of this.trail) t.life -= dt
    this.trail = this.trail.filter((t) => t.life > 0)

    // spawn com densidade crescente
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawn()
      const interval = Math.max(0.75 - this.time * 0.01, 0.16)
      this.spawnTimer = rand(interval * 0.6, interval)
    }

    for (const o of this.obstacles) {
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.angle += o.spin * dt
      if (o.kind === 'alien') o.x += Math.sin(this.time * 3 + o.seed) * 60 * dt
      if (o.kind === 'comet' && Math.random() < 0.5) {
        this.particles.list.push({
          x: o.x - o.vx * 0.02,
          y: o.y - o.vy * 0.02,
          vx: rand(-12, 12),
          vy: rand(-12, 12),
          life: rand(0.2, 0.4),
          maxLife: 0.4,
          color: '#33E0D6',
          size: rand(1, 2.4),
        })
      }
    }
    this.obstacles = this.obstacles.filter(
      (o) => o.y < DESVIO_H + 60 && o.x > -80 && o.x < DESVIO_W + 80,
    )

    // um toque e acabou
    for (const o of this.obstacles) {
      if (circleHit(this.ship, o)) {
        this.over = true
        this.shake.kick(14)
        this.waves.add(this.ship.x, this.ship.y, 90, '#F252C1')
        this.waves.add(this.ship.x, this.ship.y, 50, '#FFC53D')
        this.particles.burst(this.ship.x, this.ship.y, '#F252C1', 30, 280)
        this.particles.burst(this.ship.x, this.ship.y, '#FFC53D', 22, 200)
        this.cb.onGameOver(this.points)
        return
      }
    }

    // marcos de pontuação flutuando
    if (this.points >= this.lastMilestone + 250) {
      this.lastMilestone = this.points
      this.texts.add(this.ship.x, this.ship.y - 30, `${this.points}!`, '#33E0D6', 18)
    }

    const secs = Math.floor(this.time)
    if (secs !== this.lastHud) {
      this.lastHud = secs
      this.cb.onHud({ points: this.points, seconds: secs })
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // espaço profundo com gradiente + nebulosas
    const bg = ctx.createLinearGradient(0, 0, 0, DESVIO_H)
    bg.addColorStop(0, '#0B0618')
    bg.addColorStop(0.6, '#140E26')
    bg.addColorStop(1, '#1A0F33')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, DESVIO_W, DESVIO_H)
    this.nebulas.draw(ctx)
    this.stars.draw(ctx)

    const shake = this.shake.offset()
    ctx.save()
    ctx.translate(shake.x, shake.y)

    // rastro do motor
    for (const t of this.trail) {
      ctx.globalAlpha = (t.life / 0.35) * 0.5
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 7)
      g.addColorStop(0, '#33E0D6')
      g.addColorStop(1, 'rgba(51,224,214,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(t.x, t.y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    for (const o of this.obstacles) {
      ctx.save()
      ctx.translate(o.x, o.y)
      ctx.rotate(o.angle)
      if (o.kind === 'asteroid') {
        // rocha com iluminação e crateras
        const body = ctx.createRadialGradient(-o.r * 0.4, -o.r * 0.4, o.r * 0.2, 0, 0, o.r * 1.15)
        body.addColorStop(0, '#C9BFE8')
        body.addColorStop(0.65, '#8D80B8')
        body.addColorStop(1, '#4A3D78')
        ctx.fillStyle = body
        ctx.beginPath()
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2
          const rr = o.r * (0.82 + 0.18 * Math.sin(i * 2.1 + o.seed))
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(30,20,60,0.45)'
        for (const [cx, cy, cr] of [
          [-o.r * 0.3, -o.r * 0.1, 0.2],
          [o.r * 0.25, o.r * 0.3, 0.16],
          [o.r * 0.1, -o.r * 0.4, 0.12],
        ] as const) {
          ctx.beginPath()
          ctx.arc(cx, cy, o.r * cr, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (o.kind === 'comet') {
        ctx.rotate(Math.atan2(o.vy, o.vx))
        const tail = ctx.createLinearGradient(-56, 0, 8, 0)
        tail.addColorStop(0, 'rgba(51,224,214,0)')
        tail.addColorStop(0.7, 'rgba(51,224,214,0.35)')
        tail.addColorStop(1, 'rgba(244,239,255,0.9)')
        ctx.fillStyle = tail
        ctx.beginPath()
        ctx.moveTo(-56, 0)
        ctx.quadraticCurveTo(-18, -7, 6, -4)
        ctx.lineTo(8, 0)
        ctx.lineTo(6, 4)
        ctx.quadraticCurveTo(-18, 7, -56, 0)
        ctx.closePath()
        ctx.fill()
        withGlow(ctx, '#7FF3EC', 14, () => {
          const head = ctx.createRadialGradient(4, 0, 0, 4, 0, 6)
          head.addColorStop(0, '#FFFFFF')
          head.addColorStop(1, '#33E0D6')
          ctx.fillStyle = head
          ctx.beginPath()
          ctx.arc(4, 0, 5, 0, Math.PI * 2)
          ctx.fill()
        })
      } else {
        // disco voador vítreo com luzes girando
        ctx.rotate(-o.angle) // não gira o corpo, só as luzes
        withGlow(ctx, '#55E07F', 10, () => {
          const saucer = ctx.createLinearGradient(0, -6, 0, 8)
          saucer.addColorStop(0, '#7BEBA0')
          saucer.addColorStop(1, '#2E9257')
          ctx.fillStyle = saucer
          ctx.beginPath()
          ctx.ellipse(0, 0, o.r, o.r * 0.42, 0, 0, Math.PI * 2)
          ctx.fill()
        })
        const dome = ctx.createRadialGradient(-2, -6, 1, 0, -4, 8)
        dome.addColorStop(0, 'rgba(244,239,255,0.95)')
        dome.addColorStop(1, 'rgba(157,92,255,0.55)')
        ctx.fillStyle = dome
        ctx.beginPath()
        ctx.arc(0, -3.5, o.r * 0.45, Math.PI, 0)
        ctx.fill()
        for (let i = 0; i < 4; i++) {
          const a = o.angle * 2 + (i / 4) * Math.PI * 2
          const lx = Math.cos(a) * o.r * 0.7
          ctx.fillStyle = i % 2 ? '#FFC53D' : '#F252C1'
          ctx.beginPath()
          ctx.arc(lx, 2.5, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    // a nave do jogador
    if (!this.over) {
      const { x, y } = this.ship
      const tilt = clamp(this.ship.vx / 900, -0.35, 0.35)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(tilt)
      // chama do motor com glow
      withGlow(ctx, '#FF8244', 16, () => {
        const flame = ctx.createLinearGradient(0, 10, 0, 24)
        flame.addColorStop(0, '#FFF9F0')
        flame.addColorStop(0.4, '#FFC53D')
        flame.addColorStop(1, 'rgba(255,130,68,0)')
        ctx.fillStyle = flame
        const f = 18 + Math.sin(this.time * 32) * 3.5
        ctx.beginPath()
        ctx.moveTo(-4, 11)
        ctx.quadraticCurveTo(0, f + 6, 4, 11)
        ctx.closePath()
        ctx.fill()
      })
      // fuselagem com gradiente e brilho de borda
      withGlow(ctx, 'rgba(51,224,214,0.7)', 10, () => {
        const hull = ctx.createLinearGradient(-11, 0, 11, 0)
        hull.addColorStop(0, '#1E8F88')
        hull.addColorStop(0.5, '#4FEFE4')
        hull.addColorStop(1, '#1E8F88')
        ctx.fillStyle = hull
        ctx.beginPath()
        ctx.moveTo(0, -17)
        ctx.quadraticCurveTo(9, -2, 11, 11)
        ctx.quadraticCurveTo(4, 6, 0, 7)
        ctx.quadraticCurveTo(-4, 6, -11, 11)
        ctx.quadraticCurveTo(-9, -2, 0, -17)
        ctx.closePath()
        ctx.fill()
      })
      // cockpit
      const cockpit = ctx.createRadialGradient(-1, -6, 0.5, 0, -5, 5)
      cockpit.addColorStop(0, '#FFFFFF')
      cockpit.addColorStop(1, '#9D5CFF')
      ctx.fillStyle = cockpit
      ctx.beginPath()
      ctx.ellipse(0, -5, 3.2, 4.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    this.particles.draw(ctx)
    this.waves.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    drawVignette(ctx, DESVIO_W, DESVIO_H, 0.55)
  }
}
