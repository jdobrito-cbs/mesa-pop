/**
 * Esquadrão 42 — shoot'em up top-down com scroll vertical sobre um CENÁRIO
 * VIVO: campos, estrada com carros (atingíveis), tanques no chão (atiram de
 * volta), árvores e casas. Inimigos aéreos: helicópteros e aviões grandes e
 * pequenos. A cada 5 minutos, um AVIÃO ENORME (boss). Tecla/botão de LOOP
 * para escapar (invencível durante, com cooldown). Armas até acabar. 3 vidas.
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
  type GameHost,
} from '../engine/core'

export const ESQ_W = 480
export const ESQ_H = 640

const GROUND_SPEED = 95
const BOSS_INTERVAL = 300 // 5 minutos
const LOOP_DURATION = 0.9
const LOOP_COOLDOWN = 6

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

type AirKind = 'heli' | 'aviaozinho' | 'aviao-grande'
interface AirEnemy {
  kind: AirKind
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

type GroundKind = 'carro' | 'tanque'
interface GroundEnemy {
  kind: GroundKind
  x: number
  y: number
  lane: number
  r: number
  hp: number
  maxHp: number
  points: number
  fireTimer: number
  flash: number
  color: string
}

interface Boss {
  x: number
  y: number
  hp: number
  maxHp: number
  t: number
  fireA: number
  fireB: number
  flash: number
  dying: number
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
  onHud(hud: {
    points: number
    lives: number
    weapon: string
    ammo: number | null
    bombs: number
    loopReady: boolean
  }): void
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

export class EsquadraoGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private waves = new Shockwaves()
  private shake = new ScreenShake()
  private cloudsNear: Array<{ x: number; y: number; r: number }> = []
  private plane = { x: ESQ_W / 2, y: ESQ_H - 90, r: 12, vx: 0 }
  private exhaust: Array<{ x: number; y: number; life: number }> = []
  private bullets: Bullet[] = []
  private enemyBullets: Bullet[] = []
  private air: AirEnemy[] = []
  private ground: GroundEnemy[] = []
  private boss: Boss | null = null
  private bossTimer: number
  private bossCount = 0
  private powerups: PowerUp[] = []
  private scroll = 0
  private points = 0
  private lives = 3
  private invincible = 0
  private weapon: WeaponKind = 'reto'
  private ammo = 0
  private bombs = 0
  private fireTimer = 0
  private airTimer = 1.2
  private carTimer = 1.5
  private tankTimer = 5
  private powerupTimer = 6
  private time = 0
  private over = false
  private bombFlash = 0
  private bombWasPressed = false
  private loopT = 0
  private loopCd = 0
  private loopWasPressed = false

  constructor(private cb: EsquadraoCallbacks) {
    for (let i = 0; i < 5; i++) {
      this.cloudsNear.push({ x: rand(0, ESQ_W), y: rand(0, ESQ_H), r: rand(26, 55) })
    }
    this.bossTimer = BOSS_INTERVAL
    // atalhos SÓ de desenvolvimento (removidos do build de produção):
    // __bossEarly antecipa o boss; __photoMode deixa o avião invulnerável
    // para capturas de tela.
    if (import.meta.env.DEV) {
      const g = globalThis as Record<string, unknown>
      if (g.__bossEarly) this.bossTimer = 14
      if (g.__photoMode) this.photoMode = true
    }
    this.pushHud()
  }

  private photoMode = false

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      lives: this.lives,
      weapon: WEAPON_INFO[this.weapon].name,
      ammo: this.weapon === 'reto' ? null : this.ammo,
      bombs: this.bombs,
      loopReady: this.loopCd <= 0,
    })
  }

  /** centro da estrada na altura y (curva suave) */
  private roadX(y: number) {
    return ESQ_W * 0.62 + Math.sin((y + this.scroll) * 0.005) * 26
  }

  /* ---------------- spawns ---------------- */

  private spawnAir() {
    const difficulty = Math.min(this.time / 90, 1)
    const roll = Math.random()
    const x = rand(24, ESQ_W - 24)
    if (roll < 0.4) {
      this.air.push({ kind: 'aviaozinho', x, y: -20, vx: rand(-20, 20), vy: 150 + difficulty * 110, r: 11, hp: 1, maxHp: 1, points: 100, fireTimer: 99, t: rand(0, 6), flash: 0 })
    } else if (roll < 0.75) {
      this.air.push({ kind: 'heli', x, y: -20, vx: 0, vy: 85 + difficulty * 55, r: 13, hp: 2, maxHp: 2, points: 150, fireTimer: rand(1.2, 2.4), t: rand(0, 6), flash: 0 })
    } else {
      this.air.push({ kind: 'aviao-grande', x, y: -30, vx: rand(-14, 14), vy: 55 + difficulty * 30, r: 20, hp: 4, maxHp: 4, points: 400, fireTimer: rand(0.9, 1.6), t: 0, flash: 0 })
    }
  }

  private spawnCar() {
    const lane = Math.random() < 0.5 ? -13 : 13
    const colors = ['#F252C1', '#FFC53D', '#33E0D6', '#FF8244', '#F4EFFF']
    this.ground.push({
      kind: 'carro',
      x: 0, // calculado pela estrada
      y: lane > 0 ? -20 : ESQ_H + 20,
      lane,
      r: 10,
      hp: 1,
      maxHp: 1,
      points: 50,
      fireTimer: 99,
      flash: 0,
      color: colors[Math.floor(rand(0, colors.length))]!,
    })
  }

  private spawnTank() {
    const side = Math.random() < 0.5 ? -1 : 1
    const rx = this.roadX(-30)
    const x = clamp(rx + side * rand(80, 160), 30, ESQ_W - 30)
    this.ground.push({
      kind: 'tanque',
      x,
      y: -26,
      lane: 0,
      r: 15,
      hp: 3,
      maxHp: 3,
      points: 300,
      fireTimer: rand(1.2, 2),
      flash: 0,
      color: '#4A5D3A',
    })
  }

  private spawnBoss() {
    this.bossCount++
    this.boss = {
      x: ESQ_W / 2,
      y: -120,
      hp: 120 + this.bossCount * 40,
      maxHp: 120 + this.bossCount * 40,
      t: 0,
      fireA: 1.5,
      fireB: 3,
      flash: 0,
      dying: 0,
    }
    this.texts.add(ESQ_W / 2, ESQ_H * 0.4, '⚠ BOSS! ⚠', '#FF8244', 26)
    this.shake.kick(8)
  }

  private spawnPowerup(x?: number, y?: number) {
    const kinds: PowerUp['kind'][] = ['espalhado', 'laser', 'missil', 'bomba', 'vida']
    const kind = kinds[Math.floor(rand(0, this.lives >= 5 ? 4 : 5))]!
    this.powerups.push({ kind, x: x ?? rand(30, ESQ_W - 30), y: y ?? -18, r: 13, t: rand(0, 6) })
  }

  /* ---------------- armas e ações ---------------- */

  private fire() {
    if (this.loopT > 0) return // sem tiro durante o loop
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
      for (const e of this.air) {
        if (Math.abs(e.x - x) < e.r + 5 && e.y < y) this.damageAir(e, 2)
      }
      if (this.boss && Math.abs(this.boss.x - x) < 80 && this.boss.y < y) this.damageBoss(2)
      this.ammo--
      this.fireTimer = 0.09
    } else if (w === 'missil') {
      this.bullets.push({ x: x - 8, y: y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: WEAPON_INFO.missil.color })
      this.bullets.push({ x: x + 8, y: y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: WEAPON_INFO.missil.color })
      this.ammo -= 1
      this.fireTimer = 0.34
    }
    if (this.weapon !== 'reto' && this.ammo <= 0) this.weapon = 'reto'
    this.pushHud()
  }

  /** bomba de tela — também exposta como botão de toque */
  triggerBomb() {
    if (this.over || this.bombs <= 0) return
    this.bombs--
    this.bombFlash = 0.35
    this.shake.kick(12)
    this.waves.add(this.plane.x, this.plane.y, 240, '#FFC53D')
    for (const e of [...this.air]) this.damageAir(e, 99)
    for (const g of [...this.ground]) this.damageGround(g, 99)
    if (this.boss) this.damageBoss(20)
    this.enemyBullets = []
    this.pushHud()
  }

  /** loop de escape — invencível durante; também exposto como botão */
  triggerLoop() {
    if (this.over || this.loopT > 0 || this.loopCd > 0) return
    this.loopT = LOOP_DURATION
    this.loopCd = LOOP_COOLDOWN
    this.waves.add(this.plane.x, this.plane.y, 46, '#33E0D6')
    this.texts.add(this.plane.x, this.plane.y - 26, 'LOOP!', '#33E0D6', 16)
    this.pushHud()
  }

  /* ---------------- dano ---------------- */

  private explode(x: number, y: number, big = false) {
    this.particles.burst(x, y, '#FF8244', big ? 26 : 16, big ? 260 : 200)
    this.particles.burst(x, y, '#FFC53D', big ? 14 : 8, 140)
    this.waves.add(x, y, big ? 64 : 34, '#FF8244')
  }

  private score(x: number, y: number, points: number, big = false) {
    this.points += points
    this.texts.add(x, y - 6, `+${points}`, big ? '#FFC53D' : '#F4EFFF', big ? 17 : 13)
    this.pushHud()
  }

  private damageAir(e: AirEnemy, amount: number) {
    e.hp -= amount
    e.flash = 0.09
    if (e.hp <= 0) {
      this.explode(e.x, e.y, e.kind === 'aviao-grande')
      if (e.kind === 'aviao-grande') this.shake.kick(6)
      this.air = this.air.filter((x) => x !== e)
      this.score(e.x, e.y, e.points, e.kind === 'aviao-grande')
      if (e.kind === 'aviao-grande' && Math.random() < 0.45) this.spawnPowerup(e.x, e.y)
    }
  }

  private damageGround(g: GroundEnemy, amount: number) {
    g.hp -= amount
    g.flash = 0.09
    if (g.hp <= 0) {
      this.explode(g.x, g.y, g.kind === 'tanque')
      if (g.kind === 'tanque') this.shake.kick(5)
      this.ground = this.ground.filter((x) => x !== g)
      this.score(g.x, g.y, g.points, g.kind === 'tanque')
    }
  }

  private damageBoss(amount: number) {
    if (!this.boss || this.boss.dying > 0) return
    this.boss.hp -= amount
    this.boss.flash = 0.08
    if (this.boss.hp <= 0) {
      this.boss.dying = 1.1
      this.shake.kick(16)
    }
  }

  private hitPlayer() {
    if (this.photoMode || this.invincible > 0 || this.loopT > 0 || this.over) return
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

  /* ---------------- loop principal ---------------- */

  update(dt: number) {
    this.particles.update(dt)
    this.texts.update(dt)
    this.waves.update(dt)
    this.shake.update(dt)
    if (this.over) return
    this.time += dt
    this.scroll += GROUND_SPEED * dt
    this.invincible = Math.max(0, this.invincible - dt)
    this.bombFlash = Math.max(0, this.bombFlash - dt)
    const loopWasActive = this.loopT > 0
    this.loopT = Math.max(0, this.loopT - dt)
    const cdBefore = this.loopCd
    this.loopCd = Math.max(0, this.loopCd - dt)
    if ((loopWasActive && this.loopT === 0) || (cdBefore > 0 && this.loopCd === 0)) this.pushHud()

    for (const c of this.cloudsNear) {
      c.y += 70 * dt
      if (c.y - c.r > ESQ_H) {
        c.y = -c.r
        c.x = rand(0, ESQ_W)
      }
    }

    // movimento
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

    this.exhaust.push({ x: this.plane.x - 5 + rand(-1, 1), y: this.plane.y + 15, life: 0.3 })
    this.exhaust.push({ x: this.plane.x + 5 + rand(-1, 1), y: this.plane.y + 15, life: 0.3 })
    for (const t of this.exhaust) t.life -= dt
    this.exhaust = this.exhaust.filter((t) => t.life > 0)

    // fogo automático + bomba + loop
    this.fireTimer -= dt
    if (this.fireTimer <= 0) this.fire()
    const bombPressed = this.input.pressed('b') || this.input.pressed(' ')
    if (bombPressed && !this.bombWasPressed) this.triggerBomb()
    this.bombWasPressed = bombPressed
    const loopPressed = this.input.pressed('l') || this.input.pressed('shift')
    if (loopPressed && !this.loopWasPressed) this.triggerLoop()
    this.loopWasPressed = loopPressed

    // spawns
    const bossActive = this.boss !== null
    this.airTimer -= dt
    if (this.airTimer <= 0) {
      this.spawnAir()
      const base = Math.max(1.2 - this.time * 0.008, 0.35)
      this.airTimer = bossActive ? base * 2.4 : base
    }
    this.carTimer -= dt
    if (this.carTimer <= 0) {
      this.spawnCar()
      this.carTimer = rand(1.6, 3.2)
    }
    this.tankTimer -= dt
    if (this.tankTimer <= 0) {
      this.spawnTank()
      this.tankTimer = rand(6, 10)
    }
    this.powerupTimer -= dt
    if (this.powerupTimer <= 0) {
      this.spawnPowerup()
      this.powerupTimer = rand(7, 12)
    }
    if (!bossActive) {
      this.bossTimer -= dt
      if (this.bossTimer <= 0) this.spawnBoss()
    }

    // balas do jogador
    for (const b of this.bullets) {
      if (b.homing) {
        const targets: Array<{ x: number; y: number }> = [...this.air, ...this.ground]
        if (this.boss && this.boss.dying <= 0) targets.push(this.boss)
        if (targets.length) {
          let nearest = targets[0]!
          let best = Infinity
          for (const e of targets) {
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
            x: b.x, y: b.y, vx: rand(-14, 14), vy: rand(-8, 24),
            life: rand(0.2, 0.42), maxLife: 0.42, color: 'rgba(244,239,255,0.7)', size: rand(1.6, 3),
          })
        }
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    this.bullets = this.bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < ESQ_W + 20)

    // inimigos aéreos
    for (const e of this.air) {
      e.t += dt
      e.flash = Math.max(0, e.flash - dt)
      if (e.kind === 'heli') e.x += Math.sin(e.t * 2.2) * 70 * dt
      if (e.kind === 'aviaozinho' && e.y < this.plane.y - 80) {
        e.vx = clamp((this.plane.x - e.x) * 1.2, -150, 150)
      }
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.fireTimer -= dt
      if (e.fireTimer <= 0 && (e.kind === 'heli' || e.kind === 'aviao-grande') && e.y > 0) {
        const ddx = this.plane.x - e.x
        const ddy = this.plane.y - e.y
        const d = Math.hypot(ddx, ddy) || 1
        this.enemyBullets.push({ x: e.x, y: e.y + e.r, vx: (ddx / d) * 200, vy: (ddy / d) * 200, r: 4, color: '#FF8244' })
        e.fireTimer = e.kind === 'aviao-grande' ? rand(1, 1.6) : rand(1.8, 3)
      }
    }
    this.air = this.air.filter((e) => e.y < ESQ_H + 40 && e.x > -60 && e.x < ESQ_W + 60)

    // inimigos de chão (presos ao cenário que rola)
    for (const g of this.ground) {
      g.flash = Math.max(0, g.flash - dt)
      if (g.kind === 'carro') {
        // carros andam na estrada: um sentido desce rápido, o outro sobe devagar
        g.y += (g.lane > 0 ? GROUND_SPEED + 70 : GROUND_SPEED - 55) * dt
        g.x = this.roadX(g.y) + g.lane
      } else {
        g.y += GROUND_SPEED * dt
        g.fireTimer -= dt
        if (g.fireTimer <= 0 && g.y > 30 && g.y < ESQ_H - 60) {
          const ddx = this.plane.x - g.x
          const ddy = this.plane.y - g.y
          const d = Math.hypot(ddx, ddy) || 1
          this.enemyBullets.push({ x: g.x, y: g.y, vx: (ddx / d) * 170, vy: (ddy / d) * 170, r: 4.5, color: '#FFC53D' })
          g.fireTimer = rand(1.8, 2.6)
        }
      }
    }
    this.ground = this.ground.filter((g) => g.y < ESQ_H + 50 && g.y > -60)

    // boss
    if (this.boss) {
      const boss = this.boss
      boss.t += dt
      boss.flash = Math.max(0, boss.flash - dt)
      if (boss.dying > 0) {
        boss.dying -= dt
        if (Math.random() < 0.5) {
          this.explode(boss.x + rand(-80, 80), boss.y + rand(-24, 24), true)
        }
        if (boss.dying <= 0) {
          this.score(boss.x, boss.y, 5000, true)
          this.texts.add(ESQ_W / 2, ESQ_H * 0.4, 'BOSS DERROTADO!', '#55E07F', 22)
          this.spawnPowerup(boss.x - 40, boss.y)
          this.spawnPowerup(boss.x + 40, boss.y)
          this.boss = null
          this.bossTimer = BOSS_INTERVAL
        }
      } else {
        if (boss.y < 100) boss.y += 50 * dt
        boss.x = ESQ_W / 2 + Math.sin(boss.t * 0.5) * (ESQ_W / 2 - 110)
        // ataque A: rajada tripla mirada
        boss.fireA -= dt
        if (boss.fireA <= 0) {
          const ddx = this.plane.x - boss.x
          const ddy = this.plane.y - boss.y
          const d = Math.hypot(ddx, ddy) || 1
          for (const s of [-0.14, 0, 0.14]) {
            const a = Math.atan2(ddy, ddx) + s
            this.enemyBullets.push({ x: boss.x, y: boss.y + 26, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 4.5, color: '#FF8244' })
          }
          boss.fireA = rand(1, 1.5)
        }
        // ataque B: leque
        boss.fireB -= dt
        if (boss.fireB <= 0) {
          for (let i = -3; i <= 3; i++) {
            const a = Math.PI / 2 + i * 0.22
            this.enemyBullets.push({ x: boss.x, y: boss.y + 26, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 4, color: '#F252C1' })
          }
          boss.fireB = rand(2.6, 3.6)
        }
      }
    }

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

    // colisões: bala do jogador × alvos (ar, chão e boss)
    for (const b of [...this.bullets]) {
      let hit = false
      for (const e of this.air) {
        if (circleHit(b, e)) {
          this.damageAir(e, 1)
          hit = true
          break
        }
      }
      if (!hit) {
        for (const g of this.ground) {
          if (circleHit(b, g)) {
            this.damageGround(g, 1)
            hit = true
            break
          }
        }
      }
      if (!hit && this.boss && this.boss.dying <= 0) {
        if (Math.abs(b.x - this.boss.x) < 85 && Math.abs(b.y - this.boss.y) < 26) {
          this.damageBoss(1)
          hit = true
        }
      }
      if (hit) {
        this.bullets = this.bullets.filter((x) => x !== b)
        this.particles.burst(b.x, b.y, '#F4EFFF', 4, 90)
      }
    }

    // jogador × perigos (aéreos e balas; o chão não colide com o avião)
    for (const e of this.air) {
      if (circleHit(this.plane, e)) this.hitPlayer()
    }
    if (this.boss && this.boss.dying <= 0 && Math.abs(this.plane.x - this.boss.x) < 85 && Math.abs(this.plane.y - this.boss.y) < 30) {
      this.hitPlayer()
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

  private drawTerrain(ctx: CanvasRenderingContext2D) {
    // campos com faixas de tons de verde
    const BAND = 90
    const first = Math.floor(-this.scroll / BAND) - 1
    for (let k = first; k * BAND + this.scroll < ESQ_H + BAND; k++) {
      const y = k * BAND + this.scroll
      const h1 = hash(k)
      const greens = ['#2E5D3A', '#2A5434', '#33663F', '#2C5936']
      ctx.fillStyle = greens[Math.floor(h1 * greens.length)]!
      ctx.fillRect(0, y, ESQ_W, BAND + 1)
      // remendos de plantação
      if (h1 > 0.35) {
        ctx.fillStyle = 'rgba(255,197,61,0.10)'
        const px = hash(k * 3 + 1) * (ESQ_W - 140)
        ctx.beginPath()
        ctx.roundRect(px, y + 12, 110 + hash(k * 7) * 60, BAND - 24, 10)
        ctx.fill()
      }
    }

    // estrada curva
    ctx.fillStyle = '#3D3A4A'
    for (let y = -20; y < ESQ_H + 20; y += 10) {
      const rx = this.roadX(y)
      ctx.fillRect(rx - 30, y, 60, 11)
    }
    // acostamento + faixa central tracejada
    for (let y = -20; y < ESQ_H + 20; y += 10) {
      const rx = this.roadX(y)
      ctx.fillStyle = 'rgba(255,249,240,0.25)'
      ctx.fillRect(rx - 30, y, 2, 11)
      ctx.fillRect(rx + 28, y, 2, 11)
      if (Math.floor((y + this.scroll) / 26) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,249,240,0.5)'
        ctx.fillRect(rx - 1.5, y, 3, 11)
      }
    }

    // árvores e casas nas margens
    for (let k = first; k * BAND + this.scroll < ESQ_H + BAND; k++) {
      const y = k * BAND + this.scroll
      for (let i = 0; i < 3; i++) {
        const h = hash(k * 13 + i * 5)
        const tx = h * ESQ_W
        const ty = y + hash(k * 17 + i) * BAND
        if (Math.abs(tx - this.roadX(ty)) < 52) continue
        if (h > 0.82) {
          // casinha
          ctx.fillStyle = 'rgba(20,14,38,0.28)'
          ctx.fillRect(tx - 8, ty - 5, 20, 16)
          ctx.fillStyle = '#8D6B4B'
          ctx.fillRect(tx - 10, ty - 8, 20, 16)
          ctx.fillStyle = '#C24A3A'
          ctx.beginPath()
          ctx.moveTo(tx - 12, ty - 8)
          ctx.lineTo(tx, ty - 16)
          ctx.lineTo(tx + 12, ty - 8)
          ctx.closePath()
          ctx.fill()
        } else {
          // árvore com sombra e copa iluminada
          ctx.fillStyle = 'rgba(20,14,38,0.3)'
          ctx.beginPath()
          ctx.ellipse(tx + 4, ty + 4, 9, 6, 0, 0, Math.PI * 2)
          ctx.fill()
          const canopy = ctx.createRadialGradient(tx - 2, ty - 3, 1, tx, ty, 10)
          canopy.addColorStop(0, '#6FBF63')
          canopy.addColorStop(1, '#20451F')
          ctx.fillStyle = canopy
          ctx.beginPath()
          ctx.arc(tx, ty, 8 + h * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  private drawGroundEnemy(ctx: CanvasRenderingContext2D, g: GroundEnemy) {
    ctx.save()
    ctx.translate(g.x, g.y)
    const flashing = g.flash > 0
    if (g.kind === 'carro') {
      if (g.lane < 0) ctx.rotate(Math.PI) // sentido contrário
      ctx.fillStyle = 'rgba(20,14,38,0.3)'
      ctx.beginPath()
      ctx.roundRect(-7, -12, 16, 26, 5)
      ctx.fill()
      const body = ctx.createLinearGradient(-8, 0, 8, 0)
      body.addColorStop(0, flashing ? '#FFF' : g.color)
      body.addColorStop(0.5, '#FFF9F0')
      body.addColorStop(1, flashing ? '#FFF' : g.color)
      ctx.fillStyle = flashing ? '#FFFFFF' : body
      ctx.beginPath()
      ctx.roundRect(-8, -14, 16, 26, 5)
      ctx.fill()
      ctx.fillStyle = 'rgba(20,14,38,0.75)'
      ctx.beginPath()
      ctx.roundRect(-5.5, -6, 11, 9, 2.5)
      ctx.fill()
      ctx.fillStyle = '#FFF9F0'
      ctx.fillRect(-6, -14, 3.4, 2.4)
      ctx.fillRect(2.6, -14, 3.4, 2.4)
    } else {
      // tanque de chão
      ctx.fillStyle = 'rgba(20,14,38,0.3)'
      ctx.beginPath()
      ctx.roundRect(-12, -9, 28, 24, 5)
      ctx.fill()
      const body = ctx.createLinearGradient(0, -12, 0, 12)
      body.addColorStop(0, flashing ? '#FFF' : '#5F7A46')
      body.addColorStop(1, flashing ? '#FFF' : '#37481F')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.roundRect(-14, -11, 28, 24, 5)
      ctx.fill()
      // esteiras
      ctx.fillStyle = 'rgba(20,14,38,0.55)'
      ctx.fillRect(-14, -11, 5, 24)
      ctx.fillRect(9, -11, 5, 24)
      // torre mirando o jogador
      const ang = Math.atan2(this.plane.y - g.y, this.plane.x - g.x)
      ctx.save()
      ctx.rotate(ang)
      ctx.fillStyle = flashing ? '#FFF' : '#2C3A17'
      ctx.fillRect(0, -2.6, 20, 5.2)
      ctx.restore()
      ctx.fillStyle = flashing ? '#FFF' : '#77925A'
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, Math.PI * 2)
      ctx.fill()
      // vida
      ctx.fillStyle = 'rgba(20,14,38,0.7)'
      ctx.fillRect(-14, -18, 28, 3)
      ctx.fillStyle = '#55E07F'
      ctx.fillRect(-14, -18, 28 * (g.hp / g.maxHp), 3)
    }
    ctx.restore()
  }

  private drawAirEnemy(ctx: CanvasRenderingContext2D, e: AirEnemy) {
    // sombra no chão
    ctx.fillStyle = 'rgba(20,14,38,0.22)'
    ctx.beginPath()
    ctx.ellipse(e.x + 12, e.y + 26, e.r * 0.9, e.r * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(e.x, e.y)
    const flashing = e.flash > 0
    if (e.kind === 'heli') {
      const body = ctx.createLinearGradient(0, -8, 0, 10)
      body.addColorStop(0, flashing ? '#FFF' : '#FF9BDD')
      body.addColorStop(1, flashing ? '#FFF' : '#C2188C')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      // cauda
      ctx.fillStyle = flashing ? '#FFF' : '#C2188C'
      ctx.fillRect(-2, -20, 4, 12)
      ctx.fillRect(-7, -21, 14, 3)
      // rotor girando
      ctx.save()
      ctx.rotate(e.t * 18)
      ctx.strokeStyle = 'rgba(244,239,255,0.75)'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(-16, 0)
      ctx.lineTo(16, 0)
      ctx.moveTo(0, -16)
      ctx.lineTo(0, 16)
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = '#140E26'
      ctx.beginPath()
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const big = e.kind === 'aviao-grande'
      const scale = big ? 1.7 : 1
      ctx.scale(scale, scale)
      const [light, dark] = big ? ['#B584FF', '#5B2BA8'] : ['#FFB08A', '#E85A1F']
      // asas
      const wing = ctx.createLinearGradient(-14, 0, 14, 0)
      wing.addColorStop(0, flashing ? '#FFF' : dark)
      wing.addColorStop(0.5, flashing ? '#FFF' : light)
      wing.addColorStop(1, flashing ? '#FFF' : dark)
      ctx.fillStyle = wing
      ctx.beginPath()
      ctx.moveTo(0, 2)
      ctx.quadraticCurveTo(-13, -4, -15, -8)
      ctx.lineTo(-13, -9.5)
      ctx.lineTo(0, -4)
      ctx.lineTo(13, -9.5)
      ctx.lineTo(15, -8)
      ctx.quadraticCurveTo(13, -4, 0, 2)
      ctx.closePath()
      ctx.fill()
      // fuselagem apontando para baixo
      const hull = ctx.createLinearGradient(-4, 0, 4, 0)
      hull.addColorStop(0, flashing ? '#FFF' : dark)
      hull.addColorStop(0.5, flashing ? '#FFF' : light)
      hull.addColorStop(1, flashing ? '#FFF' : dark)
      ctx.fillStyle = hull
      ctx.beginPath()
      ctx.moveTo(0, 13)
      ctx.quadraticCurveTo(3.6, 4, 3.2, -8)
      ctx.quadraticCurveTo(2, -12, 0, -13)
      ctx.quadraticCurveTo(-2, -12, -3.2, -8)
      ctx.quadraticCurveTo(-3.6, 4, 0, 13)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.beginPath()
      ctx.arc(0, 4, 2, 0, Math.PI * 2)
      ctx.fill()
      if (big) {
        // barra de vida do avião grande
        ctx.fillStyle = 'rgba(20,14,38,0.7)'
        ctx.fillRect(-12, -16, 24, 2.4)
        ctx.fillStyle = '#55E07F'
        ctx.fillRect(-12, -16, 24 * (e.hp / e.maxHp), 2.4)
      }
    }
    ctx.restore()
  }

  private drawBoss(ctx: CanvasRenderingContext2D) {
    const boss = this.boss!
    // sombra enorme
    ctx.fillStyle = 'rgba(20,14,38,0.28)'
    ctx.beginPath()
    ctx.ellipse(boss.x + 20, boss.y + 55, 80, 18, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(boss.x, boss.y)
    const flashing = boss.flash > 0 || boss.dying > 0
    // asas gigantes
    const wing = ctx.createLinearGradient(-90, 0, 90, 0)
    wing.addColorStop(0, flashing ? '#FFF' : '#3A2560')
    wing.addColorStop(0.5, flashing ? '#FFF' : '#7C3AED')
    wing.addColorStop(1, flashing ? '#FFF' : '#3A2560')
    ctx.fillStyle = wing
    ctx.beginPath()
    ctx.moveTo(0, 8)
    ctx.quadraticCurveTo(-70, -6, -88, -16)
    ctx.lineTo(-84, -22)
    ctx.lineTo(0, -10)
    ctx.lineTo(84, -22)
    ctx.lineTo(88, -16)
    ctx.quadraticCurveTo(70, -6, 0, 8)
    ctx.closePath()
    ctx.fill()
    // motores com chamas
    for (const mx of [-52, -26, 26, 52]) {
      ctx.fillStyle = flashing ? '#FFF' : '#241A47'
      ctx.beginPath()
      ctx.roundRect(mx - 4.5, -14, 9, 16, 4)
      ctx.fill()
      withGlow(ctx, '#FF8244', 8, () => {
        ctx.fillStyle = '#FFC53D'
        ctx.beginPath()
        ctx.moveTo(mx - 3, 2)
        ctx.quadraticCurveTo(mx, 10 + Math.sin(boss.t * 26 + mx) * 3, mx + 3, 2)
        ctx.closePath()
        ctx.fill()
      })
    }
    // fuselagem
    const hull = ctx.createLinearGradient(-14, 0, 14, 0)
    hull.addColorStop(0, flashing ? '#FFF' : '#4A2B8F')
    hull.addColorStop(0.5, flashing ? '#FFF' : '#A96FFF')
    hull.addColorStop(1, flashing ? '#FFF' : '#4A2B8F')
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(0, 42)
    ctx.quadraticCurveTo(13, 16, 12, -20)
    ctx.quadraticCurveTo(8, -34, 0, -36)
    ctx.quadraticCurveTo(-8, -34, -12, -20)
    ctx.quadraticCurveTo(-13, 16, 0, 42)
    ctx.closePath()
    ctx.fill()
    // cabine
    const cockpit = ctx.createRadialGradient(-2, 20, 1, 0, 22, 9)
    cockpit.addColorStop(0, '#FFFFFF')
    cockpit.addColorStop(1, '#FF8244')
    ctx.fillStyle = cockpit
    ctx.beginPath()
    ctx.ellipse(0, 22, 5, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // barra de vida do boss no topo
    if (boss.dying <= 0) {
      const w = ESQ_W - 60
      ctx.fillStyle = 'rgba(20,14,38,0.75)'
      ctx.beginPath()
      ctx.roundRect(30, 12, w, 10, 5)
      ctx.fill()
      const grad = ctx.createLinearGradient(30, 0, 30 + w, 0)
      grad.addColorStop(0, '#FF8244')
      grad.addColorStop(1, '#F252C1')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(30, 12, Math.max(w * (boss.hp / boss.maxHp), 6), 10, 5)
      ctx.fill()
    }
  }

  private drawPlane(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.plane
    const looping = this.loopT > 0
    const progress = looping ? 1 - this.loopT / LOOP_DURATION : 0
    const tilt = clamp(this.plane.vx / 1100, -0.3, 0.3)

    // sombra no chão (durante o loop ela se afasta — sensação de altura)
    const lift = looping ? Math.sin(progress * Math.PI) * 22 : 0
    ctx.fillStyle = 'rgba(20,14,38,0.28)'
    ctx.beginPath()
    ctx.ellipse(x + 14 + lift, y + 30 + lift, 11, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(x, y - lift)
    ctx.rotate(looping ? progress * Math.PI * 2 : tilt)
    const rollScale = looping ? 0.65 + 0.35 * Math.abs(Math.cos(progress * Math.PI * 2)) : 1 - Math.abs(tilt) * 0.55
    ctx.scale(rollScale, 1)

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

    ctx.fillStyle = '#8B5CF6'
    ctx.beginPath()
    ctx.moveTo(0, 8)
    ctx.lineTo(7, 15)
    ctx.lineTo(0, 13)
    ctx.lineTo(-7, 15)
    ctx.closePath()
    ctx.fill()

    const cockpit = ctx.createRadialGradient(-1, -8, 0.5, 0, -7, 5.5)
    cockpit.addColorStop(0, '#FFFFFF')
    cockpit.addColorStop(1, '#33E0D6')
    ctx.fillStyle = cockpit
    ctx.beginPath()
    ctx.ellipse(0, -7, 2.6, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawTerrain(ctx)

    const shake = this.shake.offset()
    ctx.save()
    ctx.translate(shake.x, shake.y)

    // chão: carros e tanques
    for (const g of this.ground) this.drawGroundEnemy(ctx, g)

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

    // power-ups
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

    // inimigos aéreos + boss
    for (const e of this.air) this.drawAirEnemy(ctx, e)
    if (this.boss) this.drawBoss(ctx)

    // laser
    if (this.weapon === 'laser' && this.ammo > 0 && !this.over && this.loopT <= 0) {
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

    // balas
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
      withGlow(ctx, b.color, 9, () => {
        const g = ctx.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, b.r)
        g.addColorStop(0, '#FFF9F0')
        g.addColorStop(1, b.color)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // avião do jogador (pisca na invencibilidade; loop sempre visível)
    if (!this.over && (this.loopT > 0 || this.invincible <= 0 || Math.floor(this.time * 12) % 2 === 0)) {
      this.drawPlane(ctx)
    }

    this.particles.draw(ctx)
    this.waves.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    // nuvens por cima (profundidade)
    for (const c of this.cloudsNear) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.4)
      g.addColorStop(0, 'rgba(244,239,255,0.16)')
      g.addColorStop(1, 'rgba(244,239,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.r * 1.5, c.r * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,249,240,${this.bombFlash * 1.8})`
      ctx.fillRect(0, 0, ESQ_W, ESQ_H)
    }
    drawVignette(ctx, ESQ_W, ESQ_H, 0.4)
  }
}
