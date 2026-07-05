/**
 * Invasores — fileiras de alienígenas descendo em bloco, barreiras
 * destrutíveis, nave bônus e velocidade que cresce conforme o bloco
 * encolhe. Ondas seguidas, cada vez mais baixas e rápidas.
 * Fogo AUTOMÁTICO; mova com setas/WASD ou arrastando o dedo.
 */
import {
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

export const INV_W = 560
export const INV_H = 640

const ALIEN_COLS = 10
const ALIEN_ROWS = 5
const ROW_COLORS = ['#F252C1', '#9D5CFF', '#33E0D6', '#55E07F', '#FFC53D']
const ROW_POINTS = [30, 25, 20, 15, 10]

interface Alien {
  col: number
  row: number
  alive: boolean
}

interface Bullet {
  x: number
  y: number
  vy: number
}

interface Block {
  x: number
  y: number
  hp: number
}

export class InvasoresGame implements GameHost {
  input = new Input()
  private stars = new Starfield(INV_W, INV_H, 70)
  private nebulas = new Nebulas(INV_W, INV_H)
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()
  private waves = new Shockwaves()

  private playerX = INV_W / 2
  private lives = 3
  private invuln = 0
  private points = 0
  private time = 0
  private over = false
  private overDelay = 0

  private wave = 1
  private aliens: Alien[] = []
  private blockX = 0
  private blockY = 0
  private stepDir = 1
  private stepTimer = 0
  private anim = 0

  private shots: Bullet[] = []
  private enemyShots: Bullet[] = []
  private fireTimer = 0
  private enemyFireTimer = 1.4

  private blocks: Block[] = []

  private ufoX: number | null = null
  private ufoTimer = 11

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.spawnWave()
    this.buildBarriers()
    this.pushHud()
  }

  private pushHud() {
    this.cb.onHud({ points: this.points, lives: this.lives, weapon: `onda ${this.wave}` })
  }

  private spawnWave() {
    this.aliens = []
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) this.aliens.push({ col: c, row: r, alive: true })
    }
    this.blockX = 55
    this.blockY = 70 + Math.min((this.wave - 1) * 22, 110)
    this.stepDir = 1
    this.stepTimer = 0
  }

  private buildBarriers() {
    this.blocks = []
    const BW = 14
    for (let b = 0; b < 4; b++) {
      const bx = 52 + b * 128
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          if (r === 2 && (c === 1 || c === 2 || c === 3)) continue // arco embaixo
          this.blocks.push({ x: bx + c * BW, y: 484 + r * BW, hp: 3 })
        }
      }
    }
  }

  private aliveCount() {
    return this.aliens.filter((a) => a.alive).length
  }

  private alienPos(a: Alien) {
    return { x: this.blockX + a.col * 42, y: this.blockY + a.row * 36 }
  }

  update(dt: number) {
    this.time += dt
    this.anim += dt
    this.stars.update(dt)
    this.nebulas.update(dt)
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    this.waves.update(dt)
    if (this.invuln > 0) this.invuln -= dt

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    // movimento do canhão (teclado ou dedo)
    const a = this.input.axis()
    this.playerX += a.x * 300 * dt
    if (this.input.pointer) this.playerX += (this.input.pointer.x - this.playerX) * Math.min(dt * 14, 1)
    this.playerX = Math.max(26, Math.min(INV_W - 26, this.playerX))

    // fogo automático
    this.fireTimer -= dt
    if (this.fireTimer <= 0) {
      this.shots.push({ x: this.playerX, y: 588, vy: -480 })
      this.fireTimer = 0.42
    }

    // bloco de alienígenas: passo lateral; borda → desce e acelera
    const alive = this.aliveCount()
    const stepEvery = Math.max(0.72 - (ALIEN_ROWS * ALIEN_COLS - alive) * 0.011 - this.wave * 0.03, 0.08)
    this.stepTimer += dt
    if (this.stepTimer >= stepEvery && alive > 0) {
      this.stepTimer = 0
      const xs = this.aliens.filter((al) => al.alive).map((al) => this.alienPos(al).x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      if ((this.stepDir > 0 && maxX + 16 >= INV_W - 30) || (this.stepDir < 0 && minX - 16 <= 30)) {
        this.stepDir *= -1
        this.blockY += 16
      } else {
        this.blockX += this.stepDir * 14
      }
      // invasores alcançaram as barreiras = fim
      const lowest = Math.max(...this.aliens.filter((al) => al.alive).map((al) => this.alienPos(al).y))
      if (lowest >= 468) this.gameOver()
    }

    // tiro inimigo: um alien da linha de baixo atira
    this.enemyFireTimer -= dt
    if (this.enemyFireTimer <= 0 && alive > 0) {
      const shooters = this.aliens.filter(
        (al) => al.alive && !this.aliens.some((b) => b.alive && b.col === al.col && b.row > al.row),
      )
      const s = shooters[Math.floor(rand(0, shooters.length))]!
      const p = this.alienPos(s)
      this.enemyShots.push({ x: p.x, y: p.y + 14, vy: 190 + this.wave * 18 })
      this.enemyFireTimer = Math.max(1.5 - this.wave * 0.12 - (55 - alive) * 0.012, 0.35)
    }

    // nave bônus
    this.ufoTimer -= dt
    if (this.ufoTimer <= 0 && this.ufoX === null) {
      this.ufoX = -40
      this.ufoTimer = rand(12, 20)
    }
    if (this.ufoX !== null) {
      this.ufoX += 130 * dt
      if (this.ufoX > INV_W + 40) this.ufoX = null
    }

    this.moveBullets(dt)
  }

  private moveBullets(dt: number) {
    for (const s of this.shots) s.y += s.vy * dt
    for (const s of this.enemyShots) s.y += s.vy * dt
    this.shots = this.shots.filter((s) => s.y > -20)
    this.enemyShots = this.enemyShots.filter((s) => s.y < INV_H + 20)

    // tiros × barreiras
    for (const list of [this.shots, this.enemyShots]) {
      for (const s of list) {
        const hit = this.blocks.find((b) => b.hp > 0 && s.x > b.x && s.x < b.x + 14 && s.y > b.y && s.y < b.y + 14)
        if (hit) {
          hit.hp--
          s.y = -999 // consome o tiro
          for (let k = 0; k < 5; k++) {
            this.particles.list.push({
              x: hit.x + 7,
              y: hit.y + 7,
              vx: rand(-70, 70),
              vy: rand(-70, 70),
              life: rand(0.2, 0.4),
              maxLife: 0.4,
              color: '#55E07F',
              size: rand(1.5, 3),
            })
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.y > -100)
    this.enemyShots = this.enemyShots.filter((s) => s.y > -100 && s.y < INV_H + 20)

    // meus tiros × aliens / nave bônus
    for (const s of this.shots) {
      for (const al of this.aliens) {
        if (!al.alive) continue
        const p = this.alienPos(al)
        if (Math.abs(s.x - p.x) < 17 && Math.abs(s.y - p.y) < 14) {
          al.alive = false
          s.y = -999
          const pts = ROW_POINTS[al.row]!
          this.points += pts
          this.texts.add(p.x, p.y, `+${pts}`, ROW_COLORS[al.row]!, 14)
          this.explode(p.x, p.y, ROW_COLORS[al.row]!)
          this.pushHud()
          break
        }
      }
      if (this.ufoX !== null && Math.abs(s.x - this.ufoX) < 24 && Math.abs(s.y - 42) < 14) {
        const bonus = [100, 150, 200, 300][Math.floor(rand(0, 4))]!
        this.points += bonus
        this.texts.add(this.ufoX, 42, `+${bonus}!`, '#FFC53D', 20)
        this.explode(this.ufoX, 42, '#FFC53D')
        this.waves.add(this.ufoX, 42, 60, '#FFC53D')
        this.ufoX = null
        s.y = -999
        this.pushHud()
      }
    }
    this.shots = this.shots.filter((s) => s.y > -100)

    // onda limpa → próxima (mais baixa e rápida)
    if (this.aliveCount() === 0) {
      this.wave++
      this.points += 200
      this.texts.add(INV_W / 2, INV_H / 2, `ONDA ${this.wave}! +200`, '#33E0D6', 26)
      this.spawnWave()
      this.pushHud()
    }

    // tiros inimigos × canhão
    if (this.invuln <= 0) {
      for (const s of this.enemyShots) {
        if (Math.abs(s.x - this.playerX) < 20 && s.y > 580 && s.y < 612) {
          s.y = INV_H + 999
          this.hitPlayer()
          break
        }
      }
      this.enemyShots = this.enemyShots.filter((s) => s.y < INV_H + 20)
    }
  }

  private explode(x: number, y: number, color: string) {
    for (let k = 0; k < 14; k++) {
      this.particles.list.push({
        x,
        y,
        vx: rand(-140, 140),
        vy: rand(-140, 140),
        life: rand(0.25, 0.55),
        maxLife: 0.55,
        color,
        size: rand(2, 4.5),
      })
    }
  }

  private hitPlayer() {
    this.lives--
    this.invuln = 1.6
    this.shake.kick(10)
    this.waves.add(this.playerX, 596, 70, '#F252C1')
    this.explode(this.playerX, 596, '#F252C1')
    this.pushHud()
    if (this.lives <= 0) this.gameOver()
  }

  private gameOver() {
    if (this.over) return
    this.over = true
    this.overDelay = 1.1
    this.shake.kick(14)
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120C24'
    ctx.fillRect(0, 0, INV_W, INV_H)
    this.nebulas.draw(ctx)
    this.stars.draw(ctx)

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    // nave bônus
    if (this.ufoX !== null) {
      withGlow(ctx, '#FFC53D', 14, () => {
        ctx.fillStyle = '#FFC53D'
        ctx.beginPath()
        ctx.ellipse(this.ufoX!, 42, 22, 9, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#FFF9F0'
        ctx.beginPath()
        ctx.ellipse(this.ufoX!, 36, 10, 7, 0, Math.PI, 0)
        ctx.fill()
      })
    }

    // alienígenas (2 quadros de "dança")
    const frame = Math.floor(this.anim * 2.2) % 2
    for (const al of this.aliens) {
      if (!al.alive) continue
      const p = this.alienPos(al)
      this.drawAlien(ctx, p.x, p.y, ROW_COLORS[al.row]!, frame === 1)
    }

    // barreiras
    for (const b of this.blocks) {
      if (b.hp <= 0) continue
      ctx.fillStyle = b.hp === 3 ? '#55E07F' : b.hp === 2 ? '#3FA860' : '#2A7343'
      ctx.beginPath()
      ctx.roundRect(b.x, b.y, 14, 14, 3)
      ctx.fill()
    }

    // tiros
    for (const s of this.shots) {
      withGlow(ctx, '#33E0D6', 8, () => {
        ctx.fillStyle = '#7CF5EC'
        ctx.fillRect(s.x - 2, s.y - 9, 4, 12)
      })
    }
    for (const s of this.enemyShots) {
      withGlow(ctx, '#F252C1', 8, () => {
        ctx.fillStyle = '#F252C1'
        const wob = Math.sin(s.y * 0.14) * 2.4
        ctx.fillRect(s.x - 2 + wob, s.y - 8, 4, 11)
      })
    }

    // canhão
    if (this.invuln <= 0 || Math.floor(this.time * 10) % 2 === 0) {
      withGlow(ctx, '#33E0D6', 10, () => {
        const g = ctx.createLinearGradient(0, 584, 0, 610)
        g.addColorStop(0, '#4FF0E5')
        g.addColorStop(1, '#1FA89E')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(this.playerX - 20, 592, 40, 14, 5)
        ctx.fill()
        ctx.beginPath()
        ctx.roundRect(this.playerX - 4, 580, 8, 14, 3)
        ctx.fill()
      })
    }

    this.waves.draw(ctx)
    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()
    drawVignette(ctx, INV_W, INV_H, 0.4)
  }

  private drawAlien(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alt: boolean) {
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = color
    // corpo
    ctx.beginPath()
    ctx.roundRect(-14, -9, 28, 18, 6)
    ctx.fill()
    // antenas
    ctx.strokeStyle = color
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(-7, -9)
    ctx.lineTo(-10, alt ? -16 : -14)
    ctx.moveTo(7, -9)
    ctx.lineTo(10, alt ? -14 : -16)
    ctx.stroke()
    // perninhas (alternam com o passo)
    ctx.beginPath()
    if (alt) {
      ctx.moveTo(-9, 9)
      ctx.lineTo(-13, 14)
      ctx.moveTo(9, 9)
      ctx.lineTo(13, 14)
    } else {
      ctx.moveTo(-9, 9)
      ctx.lineTo(-9, 15)
      ctx.moveTo(9, 9)
      ctx.lineTo(9, 15)
    }
    ctx.stroke()
    // olhos
    ctx.fillStyle = '#140E26'
    ctx.beginPath()
    ctx.arc(-5.5, -1, 2.8, 0, Math.PI * 2)
    ctx.arc(5.5, -1, 2.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFF9F0'
    ctx.beginPath()
    ctx.arc(-6.5, -2, 1, 0, Math.PI * 2)
    ctx.arc(4.5, -2, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
