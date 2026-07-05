/**
 * Esquadrão 42 — shoot'em up top-down com scroll vertical.
 * Armas pegas no caminho e usadas até acabar. 3 vidas.
 * Visual de jogo mobile: gradientes, glow, rastros, shake e pontos voando.
 */
import {
  circleHit,
  clamp,
  drawVignette,
  rand,
  withGlow,
  FloatingTexts,
  Input,
  Particles,
  ScreenShake,
  Shockwaves,
  Starfield,
  type GameHost,
} from '../engine/core'

export const ESQ_W = 480
export const ESQ_H = 640

export type WeaponKind = 'reto' | 'espalhado' | 'laser' | 'missil'

export const WEAPON_INFO: Record<WeaponKind, { name: string; color: string }> = {
  reto: { name: 'Tiro reto', color: '#F4EFFF' },
  espalhado: { name: 'Espalhado', color: '#FFC53D' },
  laser: { name: 'Laser', color: '#33E0D6' },
  missil: { name: 'Míssil', color: '#F252C1' },
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  homing?: boolean
  color: string
}

type EnemyKind = 'batedor' | 'onda' | 'cacador' | 'tanque'

interface Enemy {
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hp: number
  maxHp: number
  points: number
  fireTimer: number
  t: number
  flash: number
}

interface PowerUp {
  kind: WeaponKind | 'bomba' | 'vida'
  x: number
  y: number
  r: number
  t: number
}

export interface EsquadraoCallbacks {
  onGameOver(points: number): void
  onHud(hud: { points: number; lives: number; weapon: string; ammo: number | null; bombs: number }): void
}

export class EsquadraoGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private waves = new Shockwaves()
  private shake = new ScreenShake()
  private stars = new Starfield(ESQ_W, ESQ_H, 40)
  private cloudsFar: Array<{ x: number; y: number; r: number }> = []
  private cloudsNear: Array<{ x: number; y: number; r: number }> = []
  private plane = { x: ESQ_W / 2, y: ESQ_H - 90, r: 12, vx: 0 }
  private exhaust: Array<{ x: number; y: number; life: number }> = []
  private bullets: Bullet[] = []
  private enemyBullets: Bullet[] = []
  private enemies: Enemy[] = []
  private powerups: PowerUp[] = []
  private points = 0
  private lives = 3
  private invincible = 0
  private weapon: WeaponKind = 'reto'
  private ammo = 0
  private bombs = 0
  private fireTimer = 0
  private spawnTimer = 1
  private powerupTimer = 6
  private time = 0
  private over = false
  private bombFlash = 0
  private bombWasPressed = false

  constructor(private cb: EsquadraoCallbacks) {
    for (let i = 0; i < 6; i++) {
      this.cloudsFar.push({ x: rand(0, ESQ_W), y: rand(0, ESQ_H), r: rand(50, 100) })
    }
    for (let i = 0; i < 5; i++) {
      this.cloudsNear.push({ x: rand(0, ESQ_W), y: rand(0, ESQ_H), r: rand(26, 55) })
    }
    this.pushHud()
  }

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      lives: this.lives,
      weapon: WEAPON_INFO[this.weapon].name,
      ammo: this.weapon === 'reto' ? null : this.ammo,
      bombs: this.bombs,
    })
  }

  /* ---------------- inimigos ---------------- */

  private spawnEnemy() {
    const difficulty = Math.min(this.time / 90, 1)
    const roll = Math.random()
    const x = rand(24, ESQ_W - 24)
    const mk = (e: Omit<Enemy, 'maxHp' | 'flash' | 't'> & { t?: number }): Enemy => ({
      ...e,
      t: e.t ?? 0,
      maxHp: e.hp,
      flash: 0,
    })
    if (roll < 0.4) {
      this.enemies.push(mk({ kind: 'batedor', x, y: -20, vx: 0, vy: 130 + difficulty * 90, r: 12, hp: 1, points: 100, fireTimer: 99 }))
    } else if (roll < 0.68) {
      this.enemies.push(mk({ kind: 'onda', x, y: -20, vx: 0, vy: 90 + difficulty * 60, r: 13, hp: 2, points: 200, fireTimer: rand(1, 2.4), t: rand(0, 6) }))
    } else if (roll < 0.9) {
      this.enemies.push(mk({ kind: 'cacador', x, y: -20, vx: 0, vy: 150 + difficulty * 110, r: 12, hp: 1, points: 150, fireTimer: 99 }))
    } else {
      this.enemies.push(mk({ kind: 'tanque', x, y: -26, vx: rand(-25, 25), vy: 45 + difficulty * 25, r: 20, hp: 5, points: 500, fireTimer: rand(0.8, 1.6) }))
    }
  }

  private spawnPowerup(x?: number, y?: number) {
    const kinds: PowerUp['kind'][] = ['espalhado', 'laser', 'missil', 'bomba', 'vida']
    const kind = kinds[Math.floor(rand(0, this.lives >= 5 ? 4 : 5))]!
    this.powerups.push({ kind, x: x ?? rand(30, ESQ_W - 30), y: y ?? -18, r: 13, t: rand(0, 6) })
  }

  /* ---------------- armas ---------------- */

  private fire() {
    const { x, y } = this.plane
    const useSpecial = this.weapon !== 'reto' && this.ammo > 0
    const w = useSpecial ? this.weapon : 'reto'

    if (w === 'reto') {
      this.bullets.push({ x, y: y - 16, vx: 0, vy: -520, r: 3.5, color: WEAPON_INFO.reto.color })
      this.fireTimer = 0.17
    } else if (w === 'espalhado') {
      for (const a of [-0.32, -0.12, 0.12, 0.32]) {
        this.bullets.push({ x, y: y - 12, vx: Math.sin(a) * 460, vy: -Math.cos(a) * 460, r: 3, color: WEAPON_INFO.espalhado.color })
      }
      this.ammo--
      this.fireTimer = 0.2
    } else if (w === 'laser') {
      for (const e of this.enemies) {
        if (Math.abs(e.x - x) < e.r + 5 && e.y < y) this.damage(e, 2)
      }
      this.ammo--
      this.fireTimer = 0.09
    } else if (w === 'missil') {
      this.bullets.push({ x: x - 8, y: y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: WEAPON_INFO.missil.color })
      this.bullets.push({ x: x + 8, y: y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: WEAPON_INFO.missil.color })
      this.ammo -= 1
      this.fireTimer = 0.34
    }
    if (this.weapon !== 'reto' && this.ammo <= 0) {
      this.weapon = 'reto'
    }
    this.pushHud()
  }

  private dropBomb() {
    if (this.bombs <= 0) return
    this.bombs--
    this.bombFlash = 0.35
    this.shake.kick(12)
    this.waves.add(this.plane.x, this.plane.y, 240, '#FFC53D')
    for (const e of [...this.enemies]) this.damage(e, 99)
    this.enemyBullets = []
    this.pushHud()
  }

  private damage(e: Enemy, amount: number) {
    e.hp -= amount
    e.flash = 0.09
    if (e.hp <= 0) {
      this.points += e.points
      this.texts.add(e.x, e.y - 6, `+${e.points}`, e.kind === 'tanque' ? '#FFC53D' : '#F4EFFF', e.kind === 'tanque' ? 17 : 13)
      this.particles.burst(e.x, e.y, '#FF8244', 16, 200)
      this.particles.burst(e.x, e.y, '#FFC53D', 8, 130)
      this.waves.add(e.x, e.y, e.kind === 'tanque' ? 64 : 34, '#FF8244')
      if (e.kind === 'tanque') this.shake.kick(7)
      this.enemies = this.enemies.filter((x) => x !== e)
      if (e.kind === 'tanque' && Math.random() < 0.5) this.spawnPowerup(e.x, e.y)
      this.pushHud()
    }
  }

  private hitPlayer() {
    if (this.invincible > 0 || this.over) return
    this.lives--
    this.invincible = 2
    this.shake.kick(11)
    this.waves.add(this.plane.x, this.plane.y, 70, '#F252C1')
    this.particles.burst(this.plane.x, this.plane.y, '#F252C1', 26, 240)
    this.pushHud()
    if (this.lives <= 0) {
      this.over = true
      this.shake.kick(16)
      this.waves.add(this.plane.x, this.plane.y, 120, '#FFC53D')
      this.cb.onGameOver(this.points)
    }
  }

  /* ---------------- loop ---------------- */

  update(dt: number) {
    this.particles.update(dt)
    this.texts.update(dt)
    this.waves.update(dt)
    this.shake.update(dt)
    if (this.over) return
    this.time += dt
    this.invincible = Math.max(0, this.invincible - dt)
    this.bombFlash = Math.max(0, this.bombFlash - dt)
    this.stars.update(dt, 30)

    for (const c of this.cloudsFar) {
      c.y += 26 * dt
      if (c.y - c.r > ESQ_H) {
        c.y = -c.r
        c.x = rand(0, ESQ_W)
      }
    }
    for (const c of this.cloudsNear) {
      c.y += 64 * dt
      if (c.y - c.r > ESQ_H) {
        c.y = -c.r
        c.x = rand(0, ESQ_W)
      }
    }

    // movimento (com inclinação registrada para o desenho)
    const speed = 280
    const axis = this.input.axis()
    let dx = axis.x * speed * dt
    let dy = axis.y * speed * dt
    if (this.input.pointer) {
      const px = this.input.pointer.x - this.plane.x
      const py = this.input.pointer.y - 40 - this.plane.y
      const dist = Math.hypot(px, py)
      if (dist > 4) {
        const v = Math.min(speed * 1.2, dist * 10)
        dx += (px / dist) * v * dt
        dy += (py / dist) * v * dt
      }
    }
    this.plane.x = clamp(this.plane.x + dx, 14, ESQ_W - 14)
    this.plane.y = clamp(this.plane.y + dy, 30, ESQ_H - 20)
    this.plane.vx = dx / Math.max(dt, 0.001)

    // escape dos motores
    this.exhaust.push({ x: this.plane.x - 5 + rand(-1, 1), y: this.plane.y + 15, life: 0.3 })
    this.exhaust.push({ x: this.plane.x + 5 + rand(-1, 1), y: this.plane.y + 15, life: 0.3 })
    for (const t of this.exhaust) t.life -= dt
    this.exhaust = this.exhaust.filter((t) => t.life > 0)

    // fogo automático + bomba (tecla B / espaço)
    this.fireTimer -= dt
    if (this.fireTimer <= 0) this.fire()
    const bombPressed = this.input.pressed('b') || this.input.pressed(' ')
    if (bombPressed && !this.bombWasPressed) this.dropBomb()
    this.bombWasPressed = bombPressed

    // spawns
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnEnemy()
      this.spawnTimer = Math.max(1.1 - this.time * 0.008, 0.3)
    }
    this.powerupTimer -= dt
    if (this.powerupTimer <= 0) {
      this.spawnPowerup()
      this.powerupTimer = rand(7, 12)
    }

    // balas do jogador (mísseis perseguem + soltam fumaça)
    for (const b of this.bullets) {
      if (b.homing) {
        if (this.enemies.length) {
          let nearest = this.enemies[0]!
          let best = Infinity
          for (const e of this.enemies) {
            const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2
            if (d < best) {
              best = d
              nearest = e
            }
          }
          const ddx = nearest.x - b.x
          const ddy = nearest.y - b.y
          const dist = Math.hypot(ddx, ddy) || 1
          b.vx += (ddx / dist) * 900 * dt
          b.vy += (ddy / dist) * 900 * dt
          const v = Math.hypot(b.vx, b.vy)
          if (v > 420) {
            b.vx = (b.vx / v) * 420
            b.vy = (b.vy / v) * 420
          }
        }
        if (Math.random() < 0.6) {
          this.particles.list.push({
            x: b.x,
            y: b.y,
            vx: rand(-14, 14),
            vy: rand(-8, 24),
            life: rand(0.2, 0.42),
            maxLife: 0.42,
            color: 'rgba(244,239,255,0.7)',
            size: rand(1.6, 3),
          })
        }
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    this.bullets = this.bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < ESQ_W + 20)

    // inimigos
    for (const e of this.enemies) {
      e.t += dt
      e.flash = Math.max(0, e.flash - dt)
      if (e.kind === 'onda') e.x += Math.sin(e.t * 3) * 90 * dt
      if (e.kind === 'cacador' && e.y < this.plane.y - 60) {
        e.vx = clamp((this.plane.x - e.x) * 1.4, -170, 170)
      }
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.fireTimer -= dt
      if (e.fireTimer <= 0 && (e.kind === 'onda' || e.kind === 'tanque')) {
        const ddx = this.plane.x - e.x
        const ddy = this.plane.y - e.y
        const d = Math.hypot(ddx, ddy) || 1
        const v = 200
        this.enemyBullets.push({ x: e.x, y: e.y + e.r, vx: (ddx / d) * v, vy: (ddy / d) * v, r: 4, color: '#FF8244' })
        e.fireTimer = e.kind === 'tanque' ? rand(1, 1.6) : rand(1.8, 3)
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < ESQ_H + 40 && e.x > -50 && e.x < ESQ_W + 50)

    for (const b of this.enemyBullets) {
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    this.enemyBullets = this.enemyBullets.filter(
      (b) => b.y < ESQ_H + 20 && b.y > -20 && b.x > -20 && b.x < ESQ_W + 20,
    )

    for (const p of this.powerups) {
      p.t += dt
      p.y += 90 * dt
      p.x += Math.sin(p.t * 2.2) * 18 * dt
    }
    this.powerups = this.powerups.filter((p) => p.y < ESQ_H + 30)

    // colisões
    for (const b of [...this.bullets]) {
      for (const e of this.enemies) {
        if (circleHit(b, e)) {
          this.bullets = this.bullets.filter((x) => x !== b)
          this.particles.burst(b.x, b.y, '#F4EFFF', 4, 90)
          this.damage(e, 1)
          break
        }
      }
    }
    for (const e of this.enemies) {
      if (circleHit(this.plane, e)) this.hitPlayer()
    }
    for (const b of [...this.enemyBullets]) {
      if (circleHit(this.plane, b)) {
        this.enemyBullets = this.enemyBullets.filter((x) => x !== b)
        this.hitPlayer()
      }
    }
    for (const p of [...this.powerups]) {
      if (circleHit(this.plane, p)) {
        this.powerups = this.powerups.filter((x) => x !== p)
        if (p.kind === 'vida') {
          this.lives = Math.min(this.lives + 1, 5)
          this.texts.add(p.x, p.y, '+♥', '#F252C1', 16)
        } else if (p.kind === 'bomba') {
          this.bombs = Math.min(this.bombs + 1, 3)
          this.texts.add(p.x, p.y, '+✹ bomba', '#FF8244', 14)
        } else {
          this.weapon = p.kind
          this.ammo = p.kind === 'laser' ? 90 : p.kind === 'espalhado' ? 40 : 16
          this.texts.add(p.x, p.y, WEAPON_INFO[p.kind].name + '!', WEAPON_INFO[p.kind].color, 14)
        }
        this.particles.burst(p.x, p.y, '#55E07F', 12, 130)
        this.pushHud()
      }
    }
  }

  /* ---------------- desenho ---------------- */

  private drawPlane(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.plane
    const tilt = clamp(this.plane.vx / 1100, -0.3, 0.3)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tilt)
    // escala horizontal simula a inclinação da asa
    ctx.scale(1 - Math.abs(tilt) * 0.55, 1)

    // chamas dos motores
    withGlow(ctx, '#FF8244', 14, () => {
      const f = 10 + Math.sin(this.time * 34) * 3
      const flame = ctx.createLinearGradient(0, 12, 0, 26)
      flame.addColorStop(0, '#FFF9F0')
      flame.addColorStop(0.45, '#FFC53D')
      flame.addColorStop(1, 'rgba(255,130,68,0)')
      ctx.fillStyle = flame
      for (const fx of [-5, 5]) {
        ctx.beginPath()
        ctx.moveTo(fx - 2.4, 13)
        ctx.quadraticCurveTo(fx, 13 + f, fx + 2.4, 13)
        ctx.closePath()
        ctx.fill()
      }
    })

    // asas com gradiente
    const wing = ctx.createLinearGradient(-18, 0, 18, 0)
    wing.addColorStop(0, '#6B37C4')
    wing.addColorStop(0.5, '#B584FF')
    wing.addColorStop(1, '#6B37C4')
    ctx.fillStyle = wing
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(14, 2, 18, 9)
    ctx.quadraticCurveTo(18, 11.5, 14, 11)
    ctx.lineTo(2.5, 9)
    ctx.lineTo(-2.5, 9)
    ctx.lineTo(-14, 11)
    ctx.quadraticCurveTo(-18, 11.5, -18, 9)
    ctx.quadraticCurveTo(-14, 2, 0, -4)
    ctx.closePath()
    ctx.fill()

    // fuselagem
    withGlow(ctx, 'rgba(157,92,255,0.55)', 8, () => {
      const hull = ctx.createLinearGradient(-5, 0, 5, 0)
      hull.addColorStop(0, '#5B2BA8')
      hull.addColorStop(0.5, '#A96FFF')
      hull.addColorStop(1, '#5B2BA8')
      ctx.fillStyle = hull
      ctx.beginPath()
      ctx.moveTo(0, -19)
      ctx.quadraticCurveTo(4.6, -8, 4.2, 8)
      ctx.quadraticCurveTo(3, 14, 0, 15)
      ctx.quadraticCurveTo(-3, 14, -4.2, 8)
      ctx.quadraticCurveTo(-4.6, -8, 0, -19)
      ctx.closePath()
      ctx.fill()
    })

    // cauda
    ctx.fillStyle = '#8B5CF6'
    ctx.beginPath()
    ctx.moveTo(0, 8)
    ctx.lineTo(7, 15)
    ctx.lineTo(0, 13)
    ctx.lineTo(-7, 15)
    ctx.closePath()
    ctx.fill()

    // cockpit
    const cockpit = ctx.createRadialGradient(-1, -8, 0.5, 0, -7, 5.5)
    cockpit.addColorStop(0, '#FFFFFF')
    cockpit.addColorStop(1, '#33E0D6')
    ctx.fillStyle = cockpit
    ctx.beginPath()
    ctx.ellipse(0, -7, 2.6, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save()
    ctx.translate(e.x, e.y)
    const flashing = e.flash > 0
    if (e.kind === 'tanque') {
      withGlow(ctx, 'rgba(157,92,255,0.5)', 8, () => {
        const body = ctx.createLinearGradient(0, -e.r, 0, e.r)
        body.addColorStop(0, flashing ? '#FFFFFF' : '#4A3D78')
        body.addColorStop(1, flashing ? '#FFFFFF' : '#241A47')
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.roundRect(-e.r, -e.r * 0.72, e.r * 2, e.r * 1.44, 8)
        ctx.fill()
      })
      // torre girando para o jogador
      const ang = Math.atan2(this.plane.y - e.y, this.plane.x - e.x)
      ctx.save()
      ctx.rotate(ang)
      ctx.fillStyle = flashing ? '#FFFFFF' : '#9D5CFF'
      ctx.fillRect(0, -3, e.r * 1.1, 6)
      ctx.restore()
      const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, e.r * 0.55)
      core.addColorStop(0, '#D7BFFF')
      core.addColorStop(1, '#7C3AED')
      ctx.fillStyle = flashing ? '#FFFFFF' : core
      ctx.beginPath()
      ctx.arc(0, 0, e.r * 0.5, 0, Math.PI * 2)
      ctx.fill()
      // barra de vida
      ctx.fillStyle = 'rgba(20,14,38,0.7)'
      ctx.fillRect(-e.r, -e.r - 7, e.r * 2, 3.5)
      ctx.fillStyle = '#55E07F'
      ctx.fillRect(-e.r, -e.r - 7, e.r * 2 * (e.hp / e.maxHp), 3.5)
    } else {
      const palette: Record<Exclude<EnemyKind, 'tanque'>, [string, string]> = {
        batedor: ['#FFB08A', '#E85A1F'],
        onda: ['#FFE29A', '#E8A20F'],
        cacador: ['#FF9BDD', '#D6229E'],
      }
      const [light, dark] = palette[e.kind]
      // aponta para baixo (vindo para o jogador)
      withGlow(ctx, `${dark}88`, 7, () => {
        const body = ctx.createLinearGradient(0, -e.r, 0, e.r)
        body.addColorStop(0, flashing ? '#FFFFFF' : light)
        body.addColorStop(1, flashing ? '#FFFFFF' : dark)
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.moveTo(0, e.r * 1.1)
        ctx.quadraticCurveTo(e.r * 1.15, e.r * 0.1, e.r * 0.9, -e.r * 0.75)
        ctx.quadraticCurveTo(e.r * 0.3, -e.r * 0.35, 0, -e.r * 0.42)
        ctx.quadraticCurveTo(-e.r * 0.3, -e.r * 0.35, -e.r * 0.9, -e.r * 0.75)
        ctx.quadraticCurveTo(-e.r * 1.15, e.r * 0.1, 0, e.r * 1.1)
        ctx.closePath()
        ctx.fill()
      })
      // cockpit inimigo
      const eye = ctx.createRadialGradient(0, 0, 0.5, 0, 0, e.r * 0.3)
      eye.addColorStop(0, '#FFF9F0')
      eye.addColorStop(1, '#140E26')
      ctx.fillStyle = eye
      ctx.beginPath()
      ctx.arc(0, 0, e.r * 0.26, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  draw(ctx: CanvasRenderingContext2D) {
    // céu do entardecer em altitude
    const sky = ctx.createLinearGradient(0, 0, 0, ESQ_H)
    sky.addColorStop(0, '#120B2E')
    sky.addColorStop(0.55, '#251A47')
    sky.addColorStop(1, '#3A2560')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, ESQ_W, ESQ_H)
    this.stars.draw(ctx)

    // nuvens distantes (suaves, com gradiente radial)
    for (const c of this.cloudsFar) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.5)
      g.addColorStop(0, 'rgba(157,92,255,0.12)')
      g.addColorStop(1, 'rgba(157,92,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.r * 1.6, c.r * 0.55, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const shake = this.shake.offset()
    ctx.save()
    ctx.translate(shake.x, shake.y)

    // escape dos motores
    for (const t of this.exhaust) {
      ctx.globalAlpha = (t.life / 0.3) * 0.5
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 5)
      g.addColorStop(0, '#FFC53D')
      g.addColorStop(1, 'rgba(255,197,61,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(t.x, t.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // power-ups pulsando
    for (const p of this.powerups) {
      const color =
        p.kind === 'vida' ? '#F252C1' : p.kind === 'bomba' ? '#FF8244' : WEAPON_INFO[p.kind].color
      const pulse = 1 + Math.sin(p.t * 5) * 0.1
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(pulse, pulse)
      withGlow(ctx, color, 14, () => {
        ctx.fillStyle = 'rgba(255,249,240,0.95)'
        ctx.beginPath()
        ctx.arc(0, 0, p.r, 0, Math.PI * 2)
        ctx.fill()
      })
      const inner = ctx.createRadialGradient(-3, -3, 1, 0, 0, p.r - 2)
      inner.addColorStop(0, '#FFFFFF')
      inner.addColorStop(1, color)
      ctx.fillStyle = inner
      ctx.beginPath()
      ctx.arc(0, 0, p.r - 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.font = '800 11px "Baloo 2 Variable", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const letter =
        p.kind === 'vida' ? '♥' : p.kind === 'bomba' ? '✹' : p.kind === 'espalhado' ? 'E' : p.kind === 'laser' ? 'L' : 'M'
      ctx.fillText(letter, 0, 0.5)
      ctx.restore()
    }

    // inimigos
    for (const e of this.enemies) this.drawEnemy(ctx, e)

    // laser ativo
    if (this.weapon === 'laser' && this.ammo > 0 && !this.over) {
      withGlow(ctx, '#33E0D6', 18, () => {
        const beam = ctx.createLinearGradient(this.plane.x - 5, 0, this.plane.x + 5, 0)
        beam.addColorStop(0, 'rgba(51,224,214,0)')
        beam.addColorStop(0.5, 'rgba(51,224,214,0.45)')
        beam.addColorStop(1, 'rgba(51,224,214,0)')
        ctx.fillStyle = beam
        ctx.fillRect(this.plane.x - 5, 0, 10, this.plane.y - 14)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillRect(this.plane.x - 1.2, 0, 2.4, this.plane.y - 14)
      })
    }

    // balas com glow
    for (const b of this.bullets) {
      withGlow(ctx, b.color, 8, () => {
        ctx.fillStyle = b.color
        if (b.homing) {
          ctx.save()
          ctx.translate(b.x, b.y)
          ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2)
          ctx.beginPath()
          ctx.roundRect(-2.5, -8, 5, 15, 2.5)
          ctx.fill()
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.roundRect(b.x - b.r / 2, b.y - b.r * 1.8, b.r, b.r * 3.4, b.r / 2)
          ctx.fill()
        }
      })
    }
    for (const b of this.enemyBullets) {
      withGlow(ctx, '#FF8244', 9, () => {
        const g = ctx.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, b.r)
        g.addColorStop(0, '#FFF9F0')
        g.addColorStop(1, '#FF8244')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // avião do jogador (pisca na invencibilidade)
    if (!this.over && (this.invincible <= 0 || Math.floor(this.time * 12) % 2 === 0)) {
      this.drawPlane(ctx)
    }

    this.particles.draw(ctx)
    this.waves.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    // nuvens próximas por cima (profundidade)
    for (const c of this.cloudsNear) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.4)
      g.addColorStop(0, 'rgba(37,26,71,0.55)')
      g.addColorStop(1, 'rgba(37,26,71,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.r * 1.5, c.r * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,249,240,${this.bombFlash * 1.8})`
      ctx.fillRect(0, 0, ESQ_W, ESQ_H)
    }
    drawVignette(ctx, ESQ_W, ESQ_H, 0.45)
  }
}
