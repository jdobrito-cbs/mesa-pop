/**
 * Come-Come — labirinto, pastilhas e 4 fantasmas com personalidades:
 * o VERMELHO caça você, o ROSA arma emboscada à sua frente, o CIANO
 * alterna entre caçar e vagar, o LARANJA só caça de longe. Power pellet
 * inverte a caçada (fantasmas azuis valem 200/400/800/1600).
 * Controles: setas/WASD ou DESLIZE o dedo. Túnel dá a volta no mapa.
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

const CELL = 30
// '#' parede · '.' pastilha · 'o' power · ' ' vazio · 'T' túnel · 'H' casa
const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '####.#       #.####',
  'T....  ##H##  ....T',
  '####.# ##### #.####',
  '####.#       #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....#.....#.o#',
  '##.#.####.####.#.##',
  '#.................#',
  '###################',
]
const COLS = MAZE[0]!.length
const ROWS = MAZE.length
export const COME_W = COLS * CELL
export const COME_H = ROWS * CELL

type Dir = { x: number; y: number }
const DIRS: Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

interface Ghost {
  x: number
  y: number
  dir: Dir
  color: string
  kind: 'cacador' | 'emboscada' | 'errante' | 'timido'
  eaten: boolean
  exitDelay: number
}

export class ComeComeGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()

  private walls = new Set<number>()
  private pellets = new Set<number>()
  private powers = new Set<number>()
  private houseIdx = 0

  private px = 0
  private py = 0
  private pdir: Dir = { x: -1, y: 0 }
  private want: Dir | null = null
  private mouth = 0
  private speedMul = 1

  private ghosts: Ghost[] = []
  private powerTime = 0
  private combo = 0

  private points = 0
  private lives = 3
  private level = 1
  private freeze = 1.2 // "PRONTO?" na largada
  private over = false
  private overDelay = 0
  private swipeFrom: { x: number; y: number } | null = null

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.loadMaze()
    this.resetPositions()
    this.pushHud()
  }

  private idx(cx: number, cy: number) {
    return cy * COLS + cx
  }

  private loadMaze() {
    this.walls.clear()
    this.pellets.clear()
    this.powers.clear()
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y]![x]!
        const i = this.idx(x, y)
        if (ch === '#') this.walls.add(i)
        if (ch === '.') this.pellets.add(i)
        if (ch === 'o') this.powers.add(i)
        if (ch === 'H') this.houseIdx = i
      }
    }
  }

  private resetPositions() {
    const hx = this.houseIdx % COLS
    const hy = Math.floor(this.houseIdx / COLS)
    this.px = (9 + 0.5) * CELL
    this.py = (15 + 0.5) * CELL
    this.pdir = { x: -1, y: 0 }
    this.want = null
    this.powerTime = 0
    const kinds: Array<Pick<Ghost, 'kind' | 'color' | 'exitDelay'>> = [
      { kind: 'cacador', color: '#F252C1', exitDelay: 0 },
      { kind: 'emboscada', color: '#FF8244', exitDelay: 2 },
      { kind: 'errante', color: '#33E0D6', exitDelay: 4.5 },
      { kind: 'timido', color: '#FFC53D', exitDelay: 7 },
    ]
    this.ghosts = kinds.map((g) => ({
      ...g,
      x: (hx + 0.5) * CELL,
      y: (hy + 0.5) * CELL,
      dir: { x: 0, y: -1 },
      eaten: false,
    }))
    this.freeze = 1.2
  }

  private pushHud() {
    this.cb.onHud({ points: this.points, lives: this.lives, weapon: `fase ${this.level}` })
  }

  private walkable(cx: number, cy: number): boolean {
    if (cy < 0 || cy >= ROWS) return false
    if (cx < 0 || cx >= COLS) return cy === 8 // túnel
    return !this.walls.has(this.idx(cx, cy))
  }

  private readInput() {
    const a = this.input.axis()
    if (a.x < 0) this.want = { x: -1, y: 0 }
    else if (a.x > 0) this.want = { x: 1, y: 0 }
    else if (a.y < 0) this.want = { x: 0, y: -1 }
    else if (a.y > 0) this.want = { x: 0, y: 1 }

    if (this.input.isDown && this.input.hover) {
      if (!this.swipeFrom) this.swipeFrom = { ...this.input.hover }
      const dx = this.input.hover.x - this.swipeFrom.x
      const dy = this.input.hover.y - this.swipeFrom.y
      if (Math.hypot(dx, dy) > 26) {
        this.want =
          Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
        this.swipeFrom = { ...this.input.hover }
      }
    } else {
      this.swipeFrom = null
    }
  }

  /** move uma entidade pelos corredores; vira só no centro do tile */
  private step(e: { x: number; y: number; dir: Dir }, speed: number, want: Dir | null, dt: number): boolean {
    const cx = Math.floor(e.x / CELL)
    const cy = Math.floor(e.y / CELL)
    const centerX = (cx + 0.5) * CELL
    const centerY = (cy + 0.5) * CELL
    let turned = false

    const nearCenter = Math.abs(e.x - centerX) < speed * dt + 1 && Math.abs(e.y - centerY) < speed * dt + 1
    if (nearCenter) {
      if (want && this.walkable(cx + want.x, cy + want.y) && (want.x !== e.dir.x || want.y !== e.dir.y)) {
        e.x = centerX
        e.y = centerY
        e.dir = want
        turned = true
      } else if (!this.walkable(cx + e.dir.x, cy + e.dir.y)) {
        e.x = centerX
        e.y = centerY
        return true // parado num beco: quem chama decide
      }
    }
    e.x += e.dir.x * speed * dt
    e.y += e.dir.y * speed * dt
    // túnel
    if (e.x < -CELL / 2) e.x = COME_W + CELL / 2 - 1
    if (e.x > COME_W + CELL / 2) e.x = -CELL / 2 + 1
    return turned
  }

  private ghostTarget(g: Ghost): { x: number; y: number } {
    if (g.eaten) return { x: (this.houseIdx % COLS) * CELL, y: Math.floor(this.houseIdx / COLS) * CELL }
    if (this.powerTime > 0) return { x: rand(0, COME_W), y: rand(0, COME_H) } // foge errático
    switch (g.kind) {
      case 'cacador':
        return { x: this.px, y: this.py }
      case 'emboscada':
        return { x: this.px + this.pdir.x * 4 * CELL, y: this.py + this.pdir.y * 4 * CELL }
      case 'errante':
        return Math.floor(performance.now() / 5000) % 2 === 0
          ? { x: this.px, y: this.py }
          : { x: COME_W - 60, y: COME_H - 60 }
      case 'timido': {
        const d = Math.hypot(g.x - this.px, g.y - this.py)
        return d > 6 * CELL ? { x: this.px, y: this.py } : { x: 40, y: COME_H - 40 }
      }
    }
  }

  private steerGhost(g: Ghost) {
    const cx = Math.floor(g.x / CELL)
    const cy = Math.floor(g.y / CELL)
    const target = this.ghostTarget(g)
    const options = DIRS.filter(
      (d) => this.walkable(cx + d.x, cy + d.y) && !(d.x === -g.dir.x && d.y === -g.dir.y),
    )
    if (!options.length) {
      g.dir = { x: -g.dir.x, y: -g.dir.y }
      return
    }
    const best = options.sort((a, b) => {
      const da = Math.hypot((cx + a.x + 0.5) * CELL - target.x, (cy + a.y + 0.5) * CELL - target.y)
      const db = Math.hypot((cx + b.x + 0.5) * CELL - target.x, (cy + b.y + 0.5) * CELL - target.y)
      return da - db
    })[0]!
    g.dir = best
  }

  update(dt: number) {
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    this.mouth += dt * 9

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    this.readInput()
    if (this.freeze > 0) {
      this.freeze -= dt
      return
    }
    if (this.powerTime > 0) this.powerTime -= dt

    // jogador (meia-volta é permitida a qualquer momento)
    const pspeed = 118 * this.speedMul
    if (this.want && this.want.x === -this.pdir.x && this.want.y === -this.pdir.y) {
      this.pdir = this.want
      this.want = null
    }
    const me = { x: this.px, y: this.py, dir: this.pdir }
    this.step(me, pspeed, this.want, dt)
    this.px = me.x
    this.py = me.y
    this.pdir = me.dir

    // come pastilhas
    const ci = this.idx(Math.floor(this.px / CELL), Math.floor(this.py / CELL))
    if (this.pellets.delete(ci)) {
      this.points += 10
      this.pushHud()
    }
    if (this.powers.delete(ci)) {
      this.points += 50
      this.powerTime = 7
      this.combo = 0
      this.texts.add(this.px, this.py - 14, 'CAÇADA INVERTIDA!', '#33E0D6', 15)
      this.pushHud()
    }

    // fantasmas
    for (const g of this.ghosts) {
      if (g.exitDelay > 0) {
        g.exitDelay -= dt
        continue
      }
      const gspeed = g.eaten ? 240 : this.powerTime > 0 ? 70 : (100 + this.level * 6) * this.speedMul
      const before = { x: g.dir.x, y: g.dir.y }
      const cx = Math.floor(g.x / CELL)
      const cy = Math.floor(g.y / CELL)
      const centerX = (cx + 0.5) * CELL
      const centerY = (cy + 0.5) * CELL
      if (Math.abs(g.x - centerX) < gspeed * dt + 1 && Math.abs(g.y - centerY) < gspeed * dt + 1) {
        this.steerGhost(g)
        // snap SÓ quando muda de direção de verdade (comparar por VALOR!
        // por referência era sempre "diferente" e o fantasma ficava preso
        // vibrando no centro do tile — o bug do fantasma parado)
        if (g.dir.x !== before.x || g.dir.y !== before.y) {
          g.x = centerX
          g.y = centerY
        }
      }
      g.x += g.dir.x * gspeed * dt
      g.y += g.dir.y * gspeed * dt
      if (g.x < -CELL / 2) g.x = COME_W + CELL / 2 - 1
      if (g.x > COME_W + CELL / 2) g.x = -CELL / 2 + 1

      // fantasma comido chegou em casa: renasce
      if (g.eaten) {
        const hx = ((this.houseIdx % COLS) + 0.5) * CELL
        const hy = (Math.floor(this.houseIdx / COLS) + 0.5) * CELL
        if (Math.hypot(g.x - hx, g.y - hy) < CELL) {
          g.eaten = false
          g.exitDelay = 1.5
          g.x = hx
          g.y = hy
        }
        continue
      }

      // encontro com o jogador
      if (Math.hypot(g.x - this.px, g.y - this.py) < CELL * 0.7) {
        if (this.powerTime > 0) {
          g.eaten = true
          this.combo++
          const pts = 100 * Math.pow(2, this.combo) // 200/400/800/1600
          this.points += pts
          this.texts.add(g.x, g.y - 12, `+${pts}`, '#33E0D6', 16)
          this.pushHud()
        } else {
          this.caught()
          return
        }
      }
    }

    // fase limpa
    if (this.pellets.size === 0 && this.powers.size === 0) {
      this.level++
      this.points += 500
      this.speedMul = Math.min(this.speedMul + 0.08, 1.5)
      this.texts.add(COME_W / 2, COME_H / 2, `FASE ${this.level}! +500`, '#FFC53D', 26)
      this.loadMaze()
      this.resetPositions()
      this.pushHud()
    }
  }

  private caught() {
    this.lives--
    this.shake.kick(10)
    for (let k = 0; k < 20; k++) {
      this.particles.list.push({
        x: this.px,
        y: this.py,
        vx: rand(-150, 150),
        vy: rand(-150, 150),
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        color: '#FFC53D',
        size: rand(2.5, 5),
      })
    }
    this.pushHud()
    if (this.lives <= 0) {
      this.over = true
      this.overDelay = 1.1
    } else {
      this.resetPositions()
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120C24'
    ctx.fillRect(0, 0, COME_W, COME_H)

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    // paredes com brilho neon
    ctx.strokeStyle = '#5A3DA8'
    ctx.lineWidth = 3
    ctx.shadowColor = '#9D5CFF'
    ctx.shadowBlur = 6
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!this.walls.has(this.idx(x, y))) continue
        ctx.strokeStyle = '#6B4BBF'
        ctx.beginPath()
        ctx.roundRect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8, 6)
        ctx.stroke()
      }
    }
    ctx.shadowBlur = 0

    // pastilhas
    ctx.fillStyle = '#F4EFFF'
    for (const i of this.pellets) {
      ctx.beginPath()
      ctx.arc(((i % COLS) + 0.5) * CELL, (Math.floor(i / COLS) + 0.5) * CELL, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    const pulse = 1 + Math.sin(this.mouth) * 0.25
    for (const i of this.powers) {
      withGlow(ctx, '#FFC53D', 12, () => {
        ctx.fillStyle = '#FFC53D'
        ctx.beginPath()
        ctx.arc(((i % COLS) + 0.5) * CELL, (Math.floor(i / COLS) + 0.5) * CELL, 6.5 * pulse, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // fantasmas
    for (const g of this.ghosts) {
      this.drawGhost(ctx, g)
    }

    // come-come (boca animada na direção)
    const ang = Math.atan2(this.pdir.y, this.pdir.x)
    const open = (Math.abs(Math.sin(this.mouth)) * Math.PI) / 5 + 0.05
    withGlow(ctx, '#FFC53D', 10, () => {
      ctx.fillStyle = '#FFC53D'
      ctx.beginPath()
      ctx.moveTo(this.px, this.py)
      ctx.arc(this.px, this.py, CELL * 0.42, ang + open, ang - open + Math.PI * 2)
      ctx.closePath()
      ctx.fill()
    })

    // "PRONTO?"
    if (this.freeze > 0 && this.lives > 0) {
      ctx.font = '800 26px "Baloo 2 Variable", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#33E0D6'
      ctx.shadowColor = '#33E0D6'
      ctx.shadowBlur = 12
      ctx.fillText('PRONTO?', COME_W / 2, COME_H / 2 - 40)
      ctx.shadowBlur = 0
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()
    drawVignette(ctx, COME_W, COME_H, 0.35)
  }

  private drawGhost(ctx: CanvasRenderingContext2D, g: Ghost) {
    const frightened = this.powerTime > 0 && !g.eaten
    const flashing = frightened && this.powerTime < 2 && Math.floor(this.powerTime * 6) % 2 === 0
    const body = g.eaten ? 'rgba(0,0,0,0)' : flashing ? '#F4EFFF' : frightened ? '#4A5BD4' : g.color
    const r = CELL * 0.42
    ctx.save()
    ctx.translate(g.x, g.y)
    if (!g.eaten) {
      withGlow(ctx, frightened ? '#4A5BD4' : g.color, 8, () => {
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.arc(0, -1, r, Math.PI, 0)
        const wob = Math.sin(this.mouth * 1.4) > 0 ? 3 : 0
        ctx.lineTo(r, r - 2)
        for (let k = 2; k >= -2; k--) {
          ctx.lineTo((k / 2.5) * r + (k % 2 === 0 ? wob : -wob) * 0.6, r - 2 - (k % 2 === 0 ? 4 : 0))
        }
        ctx.closePath()
        ctx.fill()
      })
    }
    // olhos (sempre — fantasma comido é só os olhos voltando)
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#FFF9F0'
      ctx.beginPath()
      ctx.arc(side * 4.5, -3, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.beginPath()
      ctx.arc(side * 4.5 + g.dir.x * 2, -3 + g.dir.y * 2, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    if (this.powerTime > 0 && !g.eaten) {
      // boquinha assustada
      ctx.strokeStyle = '#F4EFFF'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let k = -2; k <= 2; k++) {
        ctx.lineTo(k * 3, 5 + (k % 2 === 0 ? 2 : 0))
      }
      ctx.stroke()
    }
    ctx.restore()
  }
}
