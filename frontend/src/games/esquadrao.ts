/**
 * Esquadrão 42 — shoot'em up top-down com scroll vertical.
 * Armas pegas no caminho e usadas até acabar (tiro reto infinito,
 * espalhado, laser, míssil teleguiado, bomba de tela). 3 vidas.
 */
import {
  circleHit,
  clamp,
  rand,
  Input,
  Particles,
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
  points: number
  fireTimer: number
  t: number
}

interface PowerUp {
  kind: WeaponKind | 'bomba' | 'vida'
  x: number
  y: number
  r: number
}

export interface EsquadraoCallbacks {
  onGameOver(points: number): void
  onHud(hud: { points: number; lives: number; weapon: string; ammo: number | null; bombs: number }): void
}

export class EsquadraoGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private clouds: Array<{ x: number; y: number; r: number; speed: number }> = []
  private plane = { x: ESQ_W / 2, y: ESQ_H - 90, r: 12 }
  private bullets: Bullet[] = []
  private enemyBullets: Bullet[] = []
  private enemies: Enemy[] = []
  private powerups: PowerUp[] = []
  private points = 0
  private lives = 3
  private invincible = 0
  private weapon: WeaponKind = 'reto'
  private ammo = 0 // arma especial: munição restante
  private bombs = 0
  private fireTimer = 0
  private spawnTimer = 1
  private powerupTimer = 6
  private time = 0
  private over = false
  private bombFlash = 0
  private bombWasPressed = false

  constructor(private cb: EsquadraoCallbacks) {
    for (let i = 0; i < 8; i++) {
      this.clouds.push({ x: rand(0, ESQ_W), y: rand(0, ESQ_H), r: rand(24, 60), speed: rand(30, 70) })
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
    if (roll < 0.4) {
      this.enemies.push({ kind: 'batedor', x, y: -20, vx: 0, vy: 130 + difficulty * 90, r: 12, hp: 1, points: 100, fireTimer: 99, t: 0 })
    } else if (roll < 0.68) {
      this.enemies.push({ kind: 'onda', x, y: -20, vx: 0, vy: 90 + difficulty * 60, r: 13, hp: 2, points: 200, fireTimer: rand(1, 2.4), t: rand(0, 6) })
    } else if (roll < 0.9) {
      this.enemies.push({ kind: 'cacador', x, y: -20, vx: 0, vy: 150 + difficulty * 110, r: 12, hp: 1, points: 150, fireTimer: 99, t: 0 })
    } else {
      this.enemies.push({ kind: 'tanque', x, y: -26, vx: rand(-25, 25), vy: 45 + difficulty * 25, r: 20, hp: 5, points: 500, fireTimer: rand(0.8, 1.6), t: 0 })
    }
  }

  private spawnPowerup() {
    const kinds: PowerUp['kind'][] = ['espalhado', 'laser', 'missil', 'bomba', 'vida']
    const kind = kinds[Math.floor(rand(0, this.lives >= 5 ? 4 : 5))]!
    this.powerups.push({ kind, x: rand(30, ESQ_W - 30), y: -18, r: 13 })
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
      // feixe instantâneo: atinge tudo na coluna
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
    for (const e of [...this.enemies]) this.damage(e, 99)
    this.enemyBullets = []
    this.pushHud()
  }

  private damage(e: Enemy, amount: number) {
    e.hp -= amount
    if (e.hp <= 0) {
      this.points += e.points
      this.particles.burst(e.x, e.y, '#FF8244', 16, 200)
      this.enemies = this.enemies.filter((x) => x !== e)
      // tanque derrotado às vezes solta power-up
      if (e.kind === 'tanque' && Math.random() < 0.5) {
        const kinds: PowerUp['kind'][] = ['espalhado', 'laser', 'missil', 'bomba']
        this.powerups.push({ kind: kinds[Math.floor(rand(0, 4))]!, x: e.x, y: e.y, r: 13 })
      }
      this.pushHud()
    }
  }

  private hitPlayer() {
    if (this.invincible > 0 || this.over) return
    this.lives--
    this.invincible = 2
    this.particles.burst(this.plane.x, this.plane.y, '#F252C1', 26, 240)
    this.pushHud()
    if (this.lives <= 0) {
      this.over = true
      this.cb.onGameOver(this.points)
    }
  }

  /* ---------------- loop ---------------- */

  update(dt: number) {
    if (this.over) return
    this.time += dt
    this.invincible = Math.max(0, this.invincible - dt)
    this.bombFlash = Math.max(0, this.bombFlash - dt)
    this.particles.update(dt)

    for (const c of this.clouds) {
      c.y += c.speed * dt
      if (c.y - c.r > ESQ_H) {
        c.y = -c.r
        c.x = rand(0, ESQ_W)
      }
    }

    // movimento
    const speed = 280
    const axis = this.input.axis()
    this.plane.x += axis.x * speed * dt
    this.plane.y += axis.y * speed * dt
    if (this.input.pointer) {
      const dx = this.input.pointer.x - this.plane.x
      const dy = this.input.pointer.y - 40 - this.plane.y
      const dist = Math.hypot(dx, dy)
      if (dist > 4) {
        const v = Math.min(speed * 1.2, dist * 10)
        this.plane.x += (dx / dist) * v * dt
        this.plane.y += (dy / dist) * v * dt
      }
    }
    this.plane.x = clamp(this.plane.x, 14, ESQ_W - 14)
    this.plane.y = clamp(this.plane.y, 30, ESQ_H - 20)

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

    // balas do jogador
    for (const b of this.bullets) {
      if (b.homing && this.enemies.length) {
        let nearest = this.enemies[0]!
        let best = Infinity
        for (const e of this.enemies) {
          const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2
          if (d < best) {
            best = d
            nearest = e
          }
        }
        const dx = nearest.x - b.x
        const dy = nearest.y - b.y
        const dist = Math.hypot(dx, dy) || 1
        b.vx += (dx / dist) * 900 * dt
        b.vy += (dy / dist) * 900 * dt
        const v = Math.hypot(b.vx, b.vy)
        if (v > 420) {
          b.vx = (b.vx / v) * 420
          b.vy = (b.vy / v) * 420
        }
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    this.bullets = this.bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < ESQ_W + 20)

    // inimigos
    for (const e of this.enemies) {
      e.t += dt
      if (e.kind === 'onda') e.x += Math.sin(e.t * 3) * 90 * dt
      if (e.kind === 'cacador' && e.y < this.plane.y - 60) {
        e.vx = clamp((this.plane.x - e.x) * 1.4, -170, 170)
      }
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.fireTimer -= dt
      if (e.fireTimer <= 0 && (e.kind === 'onda' || e.kind === 'tanque')) {
        const dx = this.plane.x - e.x
        const dy = this.plane.y - e.y
        const d = Math.hypot(dx, dy) || 1
        const v = 200
        this.enemyBullets.push({ x: e.x, y: e.y + e.r, vx: (dx / d) * v, vy: (dy / d) * v, r: 4, color: '#FF8244' })
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

    // power-ups caindo
    for (const p of this.powerups) p.y += 90 * dt
    this.powerups = this.powerups.filter((p) => p.y < ESQ_H + 30)

    // colisões: bala × inimigo
    for (const b of [...this.bullets]) {
      for (const e of this.enemies) {
        if (circleHit(b, e)) {
          this.bullets = this.bullets.filter((x) => x !== b)
          this.damage(e, 1)
          break
        }
      }
    }
    // jogador × inimigo/bala
    for (const e of this.enemies) {
      if (circleHit(this.plane, e)) this.hitPlayer()
    }
    for (const b of [...this.enemyBullets]) {
      if (circleHit(this.plane, b)) {
        this.enemyBullets = this.enemyBullets.filter((x) => x !== b)
        this.hitPlayer()
      }
    }
    // jogador × power-up
    for (const p of [...this.powerups]) {
      if (circleHit(this.plane, p)) {
        this.powerups = this.powerups.filter((x) => x !== p)
        if (p.kind === 'vida') {
          this.lives = Math.min(this.lives + 1, 5)
        } else if (p.kind === 'bomba') {
          this.bombs = Math.min(this.bombs + 1, 3)
        } else {
          this.weapon = p.kind
          this.ammo = p.kind === 'laser' ? 90 : p.kind === 'espalhado' ? 40 : 16
        }
        this.particles.burst(p.x, p.y, '#55E07F', 10, 120)
        this.pushHud()
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // céu com nuvens (scroll vertical)
    const sky = ctx.createLinearGradient(0, 0, 0, ESQ_H)
    sky.addColorStop(0, '#1B1235')
    sky.addColorStop(1, '#251A47')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, ESQ_W, ESQ_H)
    for (const c of this.clouds) {
      ctx.fillStyle = 'rgba(157,92,255,0.10)'
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.r * 1.5, c.r * 0.55, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,197,61,${this.bombFlash * 1.6})`
      ctx.fillRect(0, 0, ESQ_W, ESQ_H)
    }

    // power-ups
    for (const p of this.powerups) {
      ctx.save()
      ctx.translate(p.x, p.y)
      const color =
        p.kind === 'vida' ? '#F252C1' : p.kind === 'bomba' ? '#FF8244' : WEAPON_INFO[p.kind].color
      ctx.fillStyle = '#FFF9F0'
      ctx.beginPath()
      ctx.arc(0, 0, p.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(0, 0, p.r - 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const letter =
        p.kind === 'vida' ? '♥' : p.kind === 'bomba' ? '✹' : p.kind === 'espalhado' ? 'E' : p.kind === 'laser' ? 'L' : 'M'
      ctx.fillText(letter, 0, 0.5)
      ctx.restore()
    }

    // inimigos
    for (const e of this.enemies) {
      ctx.save()
      ctx.translate(e.x, e.y)
      if (e.kind === 'tanque') {
        ctx.fillStyle = '#32245F'
        ctx.beginPath()
        ctx.roundRect(-e.r, -e.r * 0.7, e.r * 2, e.r * 1.4, 6)
        ctx.fill()
        ctx.fillStyle = '#9D5CFF'
        ctx.beginPath()
        ctx.arc(0, 0, e.r * 0.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const color = e.kind === 'batedor' ? '#FF8244' : e.kind === 'onda' ? '#FFC53D' : '#F252C1'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(0, e.r)
        ctx.lineTo(e.r, -e.r * 0.7)
        ctx.lineTo(0, -e.r * 0.25)
        ctx.lineTo(-e.r, -e.r * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#140E26'
        ctx.beginPath()
        ctx.arc(0, 0, e.r * 0.24, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // balas
    for (const b of this.bullets) {
      ctx.fillStyle = b.color
      if (b.homing) {
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2)
        ctx.fillRect(-2.5, -7, 5, 14)
        ctx.restore()
      } else {
        ctx.fillRect(b.x - b.r / 2, b.y - b.r * 1.6, b.r, b.r * 3)
      }
    }
    for (const b of this.enemyBullets) {
      ctx.fillStyle = b.color
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // laser ativo desenha o feixe
    if (this.weapon === 'laser' && this.ammo > 0 && !this.over) {
      ctx.fillStyle = 'rgba(51,224,214,0.30)'
      ctx.fillRect(this.plane.x - 4, 0, 8, this.plane.y - 14)
      ctx.fillStyle = 'rgba(51,224,214,0.85)'
      ctx.fillRect(this.plane.x - 1.5, 0, 3, this.plane.y - 14)
    }

    // avião do jogador
    if (!this.over && (this.invincible <= 0 || Math.floor(this.time * 12) % 2 === 0)) {
      const { x, y } = this.plane
      ctx.save()
      ctx.translate(x, y)
      ctx.fillStyle = '#FF8244'
      ctx.beginPath()
      ctx.moveTo(-3, 14)
      ctx.lineTo(0, 22)
      ctx.lineTo(3, 14)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#9D5CFF'
      ctx.beginPath()
      ctx.moveTo(0, -18)
      ctx.lineTo(5, -2)
      ctx.lineTo(16, 6)
      ctx.lineTo(16, 10)
      ctx.lineTo(3, 8)
      ctx.lineTo(2, 14)
      ctx.lineTo(-2, 14)
      ctx.lineTo(-3, 8)
      ctx.lineTo(-16, 10)
      ctx.lineTo(-16, 6)
      ctx.lineTo(-5, -2)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#33E0D6'
      ctx.beginPath()
      ctx.arc(0, -6, 3.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    this.particles.draw(ctx)
  }
}
