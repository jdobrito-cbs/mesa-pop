/**
 * Desvio Estelar — endless de DESVIO puro. Um toque e acabou.
 * Cometas, asteroides e naves alienígenas com densidade crescente.
 * Pontuação: 10 pts por segundo de sobrevivência (validado no servidor).
 */
import {
  circleHit,
  clamp,
  rand,
  Input,
  Particles,
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
}

export interface DesvioCallbacks {
  onGameOver(points: number): void
  onHud(hud: { points: number; seconds: number }): void
}

export class DesvioGame implements GameHost {
  input = new Input()
  private stars = new Starfield(DESVIO_W, DESVIO_H)
  private particles = new Particles()
  private ship = { x: DESVIO_W / 2, y: DESVIO_H - 90, r: 11 }
  private obstacles: Obstacle[] = []
  private time = 0
  private spawnTimer = 0
  private over = false
  private lastHud = -1

  constructor(private cb: DesvioCallbacks) {}

  get points() {
    return Math.floor(this.time) * 10
  }

  private spawn() {
    const roll = Math.random()
    const difficulty = Math.min(this.time / 60, 1) // 0→1 no primeiro minuto
    if (roll < 0.55) {
      const r = rand(12, 26 + difficulty * 10)
      this.obstacles.push({
        kind: 'asteroid',
        x: rand(r, DESVIO_W - r),
        y: -r * 2,
        vx: rand(-30, 30),
        vy: rand(80, 140) + difficulty * 120,
        r,
        spin: rand(-2, 2),
        angle: rand(0, Math.PI * 2),
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
      })
    }
  }

  update(dt: number) {
    if (this.over) return
    this.time += dt
    this.stars.update(dt, 80 + this.time * 2)
    this.particles.update(dt)

    // controles: teclado ou arrastar o dedo/mouse
    const speed = 300
    const axis = this.input.axis()
    this.ship.x += axis.x * speed * dt
    this.ship.y += axis.y * speed * dt
    if (this.input.pointer) {
      const dx = this.input.pointer.x - this.ship.x
      const dy = this.input.pointer.y - this.ship.y
      const dist = Math.hypot(dx, dy)
      if (dist > 4) {
        const v = Math.min(speed * 1.2, dist * 10)
        this.ship.x += (dx / dist) * v * dt
        this.ship.y += (dy / dist) * v * dt
      }
    }
    this.ship.x = clamp(this.ship.x, 14, DESVIO_W - 14)
    this.ship.y = clamp(this.ship.y, 20, DESVIO_H - 20)

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
      if (o.kind === 'alien') o.x += Math.sin(this.time * 3 + o.y * 0.02) * 60 * dt
    }
    this.obstacles = this.obstacles.filter(
      (o) => o.y < DESVIO_H + 60 && o.x > -80 && o.x < DESVIO_W + 80,
    )

    // um toque e acabou
    for (const o of this.obstacles) {
      if (circleHit(this.ship, o)) {
        this.over = true
        this.particles.burst(this.ship.x, this.ship.y, '#F252C1', 34, 260)
        this.cb.onGameOver(this.points)
        return
      }
    }

    const secs = Math.floor(this.time)
    if (secs !== this.lastHud) {
      this.lastHud = secs
      this.cb.onHud({ points: this.points, seconds: secs })
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#140E26'
    ctx.fillRect(0, 0, DESVIO_W, DESVIO_H)
    this.stars.draw(ctx)

    for (const o of this.obstacles) {
      ctx.save()
      ctx.translate(o.x, o.y)
      ctx.rotate(o.angle)
      if (o.kind === 'asteroid') {
        ctx.fillStyle = '#B4A8D8'
        ctx.beginPath()
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2
          const rr = o.r * (0.78 + 0.24 * Math.sin(i * 2.7))
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#32245F'
        ctx.beginPath()
        ctx.arc(-o.r * 0.3, -o.r * 0.15, o.r * 0.22, 0, Math.PI * 2)
        ctx.fill()
      } else if (o.kind === 'comet') {
        ctx.rotate(Math.atan2(o.vy, o.vx))
        const grad = ctx.createLinearGradient(-38, 0, 8, 0)
        grad.addColorStop(0, 'rgba(51,224,214,0)')
        grad.addColorStop(1, '#33E0D6')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(-38, 0)
        ctx.lineTo(2, -5)
        ctx.lineTo(8, 0)
        ctx.lineTo(2, 5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#FFF9F0'
        ctx.beginPath()
        ctx.arc(4, 0, 4.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // nave alienígena
        ctx.fillStyle = '#55E07F'
        ctx.beginPath()
        ctx.ellipse(0, 0, o.r, o.r * 0.45, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#9D5CFF'
        ctx.beginPath()
        ctx.arc(0, -4, o.r * 0.42, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = '#FFC53D'
        for (const lx of [-o.r * 0.6, 0, o.r * 0.6]) {
          ctx.fillRect(lx - 1.5, 2, 3, 3)
        }
      }
      ctx.restore()
    }

    // a nave do jogador
    if (!this.over) {
      const { x, y } = this.ship
      ctx.save()
      ctx.translate(x, y)
      // chama do motor
      ctx.fillStyle = '#FF8244'
      ctx.beginPath()
      ctx.moveTo(-4, 12)
      ctx.lineTo(0, 20 + Math.sin(this.time * 30) * 4)
      ctx.lineTo(4, 12)
      ctx.closePath()
      ctx.fill()
      // fuselagem
      ctx.fillStyle = '#33E0D6'
      ctx.beginPath()
      ctx.moveTo(0, -16)
      ctx.lineTo(11, 12)
      ctx.lineTo(0, 6)
      ctx.lineTo(-11, 12)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#FFF9F0'
      ctx.beginPath()
      ctx.arc(0, -4, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    this.particles.draw(ctx)
  }
}
