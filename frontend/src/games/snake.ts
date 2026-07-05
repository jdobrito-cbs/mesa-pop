/**
 * Snake — o clássico eterno, com acabamento Mesa Pop:
 * cobra com gradiente e carinha, fruta pulsando com glow, casas em xadrez
 * sutil, partículas ao comer e velocidade crescente.
 * Controles: setas/WASD ou DESLIZE o dedo na direção desejada.
 */
import {
  drawVignette,
  rand,
  withGlow,
  FloatingTexts,
  Input,
  Particles,
  ScreenShake,
  type GameHost,
} from '../engine/core'

export const SNAKE_COLS = 22
export const SNAKE_ROWS = 16
const CELL = 30
export const SNAKE_W = SNAKE_COLS * CELL
export const SNAKE_H = SNAKE_ROWS * CELL

interface Cell {
  x: number
  y: number
}

const FRUITS = ['#F252C1', '#FFC53D', '#FF8244', '#55E07F']

export class SnakeGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()

  private snake: Cell[] = []
  private dir: Cell = { x: 1, y: 0 }
  private nextDir: Cell[] = []
  private food: Cell = { x: 0, y: 0 }
  private foodColor = FRUITS[0]!
  private moveTimer = 0
  private interval = 0.15
  private points = 0
  private eaten = 0
  private time = 0
  private over = false
  private overDelay = 0
  private swipeFrom: { x: number; y: number } | null = null

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    const cy = Math.floor(SNAKE_ROWS / 2)
    this.snake = [
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ]
    this.placeFood()
    this.pushHud()
  }

  private pushHud() {
    this.cb.onHud({ points: this.points, weapon: `🐍 ${this.snake.length}` })
  }

  private placeFood() {
    let spot: Cell
    do {
      spot = { x: Math.floor(rand(0, SNAKE_COLS)), y: Math.floor(rand(0, SNAKE_ROWS)) }
    } while (this.snake.some((s) => s.x === spot.x && s.y === spot.y))
    this.food = spot
    this.foodColor = FRUITS[this.eaten % FRUITS.length]!
  }

  private queueDir(d: Cell) {
    const last = this.nextDir[this.nextDir.length - 1] ?? this.dir
    // não pode dar meia-volta nem repetir a direção
    if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return
    if (this.nextDir.length < 2) this.nextDir.push(d)
  }

  private readInput() {
    const a = this.input.axis()
    if (a.x < 0) this.queueDir({ x: -1, y: 0 })
    else if (a.x > 0) this.queueDir({ x: 1, y: 0 })
    else if (a.y < 0) this.queueDir({ x: 0, y: -1 })
    else if (a.y > 0) this.queueDir({ x: 0, y: 1 })

    // deslize do dedo: direção dominante do arrasto
    if (this.input.isDown && this.input.hover) {
      if (!this.swipeFrom) this.swipeFrom = { ...this.input.hover }
      const dx = this.input.hover.x - this.swipeFrom.x
      const dy = this.input.hover.y - this.swipeFrom.y
      if (Math.hypot(dx, dy) > 26) {
        if (Math.abs(dx) > Math.abs(dy)) this.queueDir({ x: Math.sign(dx), y: 0 })
        else this.queueDir({ x: 0, y: Math.sign(dy) })
        this.swipeFrom = { ...this.input.hover }
      }
    } else {
      this.swipeFrom = null
    }
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false // dispara uma única vez
        this.cb.onGameOver(this.points)
      }
      return
    }

    this.readInput()

    this.moveTimer += dt
    if (this.moveTimer < this.interval) return
    this.moveTimer = 0

    if (this.nextDir.length) this.dir = this.nextDir.shift()!
    const head = this.snake[0]!
    const nx = head.x + this.dir.x
    const ny = head.y + this.dir.y

    // parede ou o próprio corpo = fim
    const hitWall = nx < 0 || nx >= SNAKE_COLS || ny < 0 || ny >= SNAKE_ROWS
    const hitSelf = this.snake.some((s, i) => i < this.snake.length - 1 && s.x === nx && s.y === ny)
    if (hitWall || hitSelf) {
      this.die()
      return
    }

    this.snake.unshift({ x: nx, y: ny })
    if (nx === this.food.x && ny === this.food.y) {
      this.points += 10
      this.eaten++
      this.interval = Math.max(0.15 - this.eaten * 0.004, 0.07)
      const px = (nx + 0.5) * CELL
      const py = (ny + 0.5) * CELL
      this.texts.add(px, py - 10, '+10', this.foodColor, 15)
      for (let i = 0; i < 12; i++) {
        this.particles.list.push({
          x: px,
          y: py,
          vx: rand(-90, 90),
          vy: rand(-90, 90),
          life: rand(0.25, 0.5),
          maxLife: 0.5,
          color: this.foodColor,
          size: rand(2, 4.5),
        })
      }
      this.placeFood()
      this.pushHud()
    } else {
      this.snake.pop()
    }
  }

  private die() {
    this.over = true
    this.overDelay = 0.9
    this.shake.kick(9)
    for (const s of this.snake) {
      this.particles.list.push({
        x: (s.x + 0.5) * CELL,
        y: (s.y + 0.5) * CELL,
        vx: rand(-120, 120),
        vy: rand(-120, 120),
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        color: '#33E0D6',
        size: rand(2.5, 5),
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // fundo em xadrez sutil
    ctx.fillStyle = '#1B1235'
    ctx.fillRect(0, 0, SNAKE_W, SNAKE_H)
    ctx.fillStyle = 'rgba(157,92,255,0.05)'
    for (let y = 0; y < SNAKE_ROWS; y++) {
      for (let x = 0; x < SNAKE_COLS; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    // fruta pulsando
    const pulse = 1 + Math.sin(this.time * 6) * 0.12
    const fx = (this.food.x + 0.5) * CELL
    const fy = (this.food.y + 0.5) * CELL
    withGlow(ctx, this.foodColor, 14, () => {
      ctx.fillStyle = this.foodColor
      ctx.beginPath()
      ctx.arc(fx, fy, CELL * 0.32 * pulse, 0, Math.PI * 2)
      ctx.fill()
    })
    // folhinha
    ctx.fillStyle = '#55E07F'
    ctx.beginPath()
    ctx.ellipse(fx + 4, fy - CELL * 0.32 * pulse - 2, 5, 2.6, -0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(fx - 3, fy - 4, 2.4, 0, Math.PI * 2)
    ctx.fill()

    // corpo da cobra (de trás para frente; cabeça por cima)
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const s = this.snake[i]!
      const t = i / Math.max(this.snake.length - 1, 1)
      const x = s.x * CELL
      const y = s.y * CELL
      const inset = 2 + t * 2.5
      const r = 9 - t * 3
      const g = ctx.createLinearGradient(x, y, x, y + CELL)
      g.addColorStop(0, i === 0 ? '#4FF0E5' : '#33E0D6')
      g.addColorStop(1, '#1FA89E')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2, r)
      ctx.fill()
      if (i === 0) {
        // carinha na direção do movimento
        const ex = x + CELL / 2 + this.dir.x * 5
        const ey = y + CELL / 2 + this.dir.y * 5
        ctx.fillStyle = '#140E26'
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(ex + this.dir.y * 5.5 * side, ey + this.dir.x * 5.5 * side, 2.6, 0, Math.PI * 2)
          ctx.fill()
        }
        // língua
        ctx.strokeStyle = '#F252C1'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + CELL / 2 + this.dir.x * 12, y + CELL / 2 + this.dir.y * 12)
        ctx.lineTo(x + CELL / 2 + this.dir.x * (12 + 5 + Math.sin(this.time * 10) * 2), y + CELL / 2 + this.dir.y * (12 + 5))
        ctx.stroke()
      } else if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.beginPath()
        ctx.arc(x + CELL / 2, y + CELL / 2, 3 - t * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    // borda de perigo
    ctx.strokeStyle = 'rgba(242,82,193,0.25)'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, SNAKE_W - 4, SNAKE_H - 4)
    drawVignette(ctx, SNAKE_W, SNAKE_H, 0.3)
  }
}
