/**
 * Cardume — você não move um personagem, você COMANDA UM ENXAME.
 * Boids (Craig Reynolds): separação + alinhamento + coesão, com:
 * - mover o ponteiro → o cardume segue;
 * - toque/clique rápido → os peixes se ESPALHAM (fuga);
 * - segurar → o cardume ORBITA o ponteiro em alta velocidade (arma!).
 * Coma peixinhos para crescer; enfrente os peixões girando o cardume.
 */
import {
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

// paisagem: bem mais espaço nas laterais para o cardume navegar
export const CARDUME_W = 900
export const CARDUME_H = 540

const MAX_FISH = 90
const TAP_MS = 220

interface Fish {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  phase: number
}

interface Food {
  x: number
  y: number
  vx: number
  phase: number
}

interface Predator {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hp: number
  maxHp: number
  angle: number
  bite: number
}

export interface CardumeCallbacks {
  onGameOver(points: number): void
  onHud(hud: { points: number; fish: number; orbiting: boolean; weapon: string }): void
}

/** a órbita é arma limitada: 3 giros de ATÉ 10s, depois 120s para recarregar */
const MAX_GIROS = 3
const RECARGA_S = 120
const ORBITA_MAX_S = 10

export class CardumeGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private waves = new Shockwaves()
  private shake = new ScreenShake()
  private fish: Fish[] = []
  private foods: Food[] = []
  private predators: Predator[] = []
  private bubbles = Array.from({ length: 24 }, () => ({
    x: rand(0, CARDUME_W),
    y: rand(0, CARDUME_H),
    r: rand(1.5, 5),
    v: rand(14, 40),
  }))
  private target = { x: CARDUME_W / 2, y: CARDUME_H / 2 }
  private time = 0
  private eats = 0
  private kills = 0
  private foodTimer = 1
  private predTimer = 6
  private scareTimer = 0
  private wasDown = false
  private over = false
  private lastHud = -1
  private giros = MAX_GIROS
  private recarga = 0
  private orbitAtivo = false
  private orbitTempo = 0

  constructor(private cb: CardumeCallbacks) {
    for (let i = 0; i < 30; i++) this.spawnFish(CARDUME_W / 2 + rand(-40, 40), CARDUME_H / 2 + rand(-40, 40))
  }

  get points() {
    return Math.floor(this.time) * 5 + this.eats * 10 + this.kills * 200
  }

  private spawnFish(x: number, y: number) {
    if (this.fish.length >= MAX_FISH) return
    this.fish.push({
      x,
      y,
      vx: rand(-40, 40),
      vy: rand(-40, 40),
      hue: Math.random() < 0.75 ? rand(165, 195) : rand(285, 320),
      phase: rand(0, Math.PI * 2),
    })
  }

  private get orbiting() {
    return this.input.isDown && performance.now() - this.input.downAt > TAP_MS
  }

  update(dt: number) {
    this.particles.update(dt)
    this.texts.update(dt)
    this.waves.update(dt)
    this.shake.update(dt)
    for (const b of this.bubbles) {
      b.y -= b.v * dt
      if (b.y < -6) {
        b.y = CARDUME_H + 6
        b.x = rand(0, CARDUME_W)
      }
    }
    if (this.over) return
    this.time += dt
    this.scareTimer = Math.max(0, this.scareTimer - dt)

    // alvo: ponteiro (hover/tocado) ou teclado
    const p = this.input.pointer ?? this.input.hover
    if (p) {
      this.target.x = clamp(p.x, 10, CARDUME_W - 10)
      this.target.y = clamp(p.y, 10, CARDUME_H - 10)
    } else {
      const axis = this.input.axis()
      this.target.x = clamp(this.target.x + axis.x * 320 * dt, 10, CARDUME_W - 10)
      this.target.y = clamp(this.target.y + axis.y * 320 * dt, 10, CARDUME_H - 10)
    }

    // toque rápido → dispersão (fuga)
    if (this.wasDown && !this.input.isDown && performance.now() - this.input.downAt < TAP_MS) {
      this.scatter()
    }
    if (this.input.pressed(' ')) this.scatter()
    this.wasDown = this.input.isDown

    // órbita LIMITADA: gasta 1 giro ao começar a segurar; 0 giros = recarga
    this.recarga = Math.max(0, this.recarga - dt)
    if (this.recarga === 0 && this.giros === 0) this.giros = MAX_GIROS
    const querOrbita = this.orbiting || this.input.pressed('shift')
    if (querOrbita && !this.orbitAtivo) {
      if (this.giros > 0) {
        this.giros--
        this.orbitAtivo = true
        this.orbitTempo = ORBITA_MAX_S // cada vórtice dura no máximo 10s
        if (this.giros === 0) this.recarga = RECARGA_S
      }
    } else if (!querOrbita) {
      this.orbitAtivo = false
    }
    // o vórtice EXPIRA sozinho mesmo com o botão seguro
    if (this.orbitAtivo) {
      this.orbitTempo -= dt
      if (this.orbitTempo <= 0) this.orbitAtivo = false
    }
    const orbit = this.orbitAtivo && querOrbita

    /* ---------- boids ---------- */
    // separação FORTE: cardume espalhado é mais difícil de defender
    const SEP = 24
    const NEIGH = 44
    for (const f of this.fish) {
      let sepX = 0
      let sepY = 0
      let aliX = 0
      let aliY = 0
      let cohX = 0
      let cohY = 0
      let n = 0
      for (const o of this.fish) {
        if (o === f) continue
        const dx = o.x - f.x
        const dy = o.y - f.y
        const d2 = dx * dx + dy * dy
        if (d2 < NEIGH * NEIGH) {
          n++
          aliX += o.vx
          aliY += o.vy
          cohX += o.x
          cohY += o.y
          if (d2 < SEP * SEP && d2 > 0.01) {
            const d = Math.sqrt(d2)
            sepX -= (dx / d) * (SEP - d)
            sepY -= (dy / d) * (SEP - d)
          }
        }
      }
      if (n > 0) {
        // menos coesão + mais separação = peixes soltos, não uma bola compacta
        f.vx += ((aliX / n - f.vx) * 1.4 + (cohX / n - f.x) * 0.9) * dt
        f.vy += ((aliY / n - f.vy) * 1.4 + (cohY / n - f.y) * 0.9) * dt
      }
      f.vx += sepX * 14 * dt
      f.vy += sepY * 14 * dt

      const tx = this.target.x - f.x
      const ty = this.target.y - f.y
      const td = Math.hypot(tx, ty) || 1
      if (orbit) {
        // orbitar: força tangencial forte + atração apertada = lâmina viva
        const tang = { x: -ty / td, y: tx / td }
        f.vx += (tang.x * 560 + (tx / td) * (td - 42) * 8) * dt
        f.vy += (tang.y * 560 + (ty / td) * (td - 42) * 8) * dt
      } else if (this.scareTimer <= 0) {
        f.vx += (tx / td) * 190 * dt
        f.vy += (ty / td) * 190 * dt
      }

      // fuga de peixões
      for (const pr of this.predators) {
        const dx = f.x - pr.x
        const dy = f.y - pr.y
        const d = Math.hypot(dx, dy)
        if (d < pr.size * 3 && d > 0.01) {
          const w = this.scareTimer > 0 ? 500 : 260
          f.vx += (dx / d) * (w / Math.max(d * 0.06, 1)) * dt
          f.vy += (dy / d) * (w / Math.max(d * 0.06, 1)) * dt
        }
      }

      const vmax = orbit ? 430 : 250
      const v = Math.hypot(f.vx, f.vy)
      if (v > vmax) {
        f.vx = (f.vx / v) * vmax
        f.vy = (f.vy / v) * vmax
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      if (f.x < 6 || f.x > CARDUME_W - 6) f.vx *= -0.8
      if (f.y < 6 || f.y > CARDUME_H - 6) f.vy *= -0.8
      f.x = clamp(f.x, 6, CARDUME_W - 6)
      f.y = clamp(f.y, 6, CARDUME_H - 6)
    }

    /* ---------- comida (peixinhos) ---------- */
    this.foodTimer -= dt
    if (this.foodTimer <= 0) {
      const fromLeft = Math.random() < 0.5
      this.foods.push({
        x: fromLeft ? -10 : CARDUME_W + 10,
        y: rand(40, CARDUME_H - 60),
        vx: (fromLeft ? 1 : -1) * rand(26, 50),
        phase: rand(0, Math.PI * 2),
      })
      this.foodTimer = rand(1.4, 2.6)
    }
    for (const food of this.foods) {
      food.x += food.vx * dt
      food.y += Math.sin(this.time * 3 + food.phase) * 18 * dt
    }
    this.foods = this.foods.filter((food) => {
      for (const f of this.fish) {
        if ((f.x - food.x) ** 2 + (f.y - food.y) ** 2 < 100) {
          this.eats++
          this.spawnFish(food.x, food.y)
          this.particles.burst(food.x, food.y, '#55E07F', 6, 80)
          this.texts.add(food.x, food.y, '+1 🐟', '#55E07F', 12)
          return false
        }
      }
      return food.x > -20 && food.x < CARDUME_W + 20
    })

    /* ---------- peixões ---------- */
    this.predTimer -= dt
    if (this.predTimer <= 0 && this.predators.length < 3) {
      const fromLeft = Math.random() < 0.5
      const size = rand(22, 30) + Math.min(this.time / 30, 8)
      this.predators.push({
        x: fromLeft ? -40 : CARDUME_W + 40,
        y: rand(60, CARDUME_H - 80),
        vx: 0,
        vy: 0,
        size,
        hp: Math.round(size / 4),
        maxHp: Math.round(size / 4),
        angle: 0,
        bite: 0,
      })
      this.predTimer = Math.max(9 - this.time * 0.04, 4)
      this.texts.add(fromLeft ? 40 : CARDUME_W - 40, 60, 'PEIXÃO!', '#FF8244', 16)
    }
    for (const pr of [...this.predators]) {
      pr.bite = Math.max(0, pr.bite - dt)
      // persegue o peixe mais próximo
      let nearest: Fish | null = null
      let best = Infinity
      for (const f of this.fish) {
        const d2 = (f.x - pr.x) ** 2 + (f.y - pr.y) ** 2
        if (d2 < best) {
          best = d2
          nearest = f
        }
      }
      if (nearest) {
        const dx = nearest.x - pr.x
        const dy = nearest.y - pr.y
        const d = Math.hypot(dx, dy) || 1
        const speed = 90 + Math.min(this.time, 60)
        pr.vx += ((dx / d) * speed - pr.vx) * 1.4 * dt
        pr.vy += ((dy / d) * speed - pr.vy) * 1.4 * dt
      }
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt
      pr.angle = Math.atan2(pr.vy, pr.vx)

      // come peixes / leva dano do cardume orbitando
      let hitsThisFrame = 0
      this.fish = this.fish.filter((f) => {
        const d2 = (f.x - pr.x) ** 2 + (f.y - pr.y) ** 2
        if (d2 < (pr.size * 0.8) ** 2) {
          const speed = Math.hypot(f.vx, f.vy)
          if (orbit && speed > 300) {
            hitsThisFrame++
            this.particles.burst(f.x, f.y, '#33E0D6', 3, 90)
            // o peixe ricocheteia em vez de morrer
            f.vx = -f.vx
            f.vy = -f.vy
            return true
          }
          if (pr.bite <= 0) {
            pr.bite = 0.25
            this.particles.burst(f.x, f.y, '#F252C1', 5, 90)
            return false // engolido
          }
        }
        return true
      })
      if (hitsThisFrame > 0) {
        pr.hp -= hitsThisFrame * 0.22
        if (pr.hp <= 0) {
          this.kills++
          this.particles.burst(pr.x, pr.y, '#FF8244', 26, 220)
          this.waves.add(pr.x, pr.y, 60, '#FFC53D')
          this.shake.kick(8)
          this.texts.add(pr.x, pr.y, '+200 — devorado!', '#FFC53D', 16)
          for (let i = 0; i < 3; i++) this.spawnFish(pr.x + rand(-14, 14), pr.y + rand(-14, 14))
          this.predators = this.predators.filter((x) => x !== pr)
        }
      }
    }

    if (this.fish.length === 0) {
      this.over = true
      this.shake.kick(12)
      this.cb.onGameOver(this.points)
      return
    }

    const secs = Math.floor(this.time)
    if (secs !== this.lastHud) {
      this.lastHud = secs
      this.cb.onHud({
        points: this.points,
        fish: this.fish.length,
        orbiting: orbit,
        weapon:
          this.recarga > 0
            ? `🌀 recarrega em ${Math.ceil(this.recarga)}s`
            : `🌀 giros ${this.giros}/${MAX_GIROS}`,
      })
    }
  }

  private scatter() {
    this.scareTimer = 0.8
    this.waves.add(this.target.x, this.target.y, 70, '#33E0D6')
    for (const f of this.fish) {
      const dx = f.x - this.target.x
      const dy = f.y - this.target.y
      const d = Math.hypot(dx, dy) || 1
      f.vx += (dx / d) * 320
      f.vy += (dy / d) * 320
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // oceano profundo
    const bg = ctx.createLinearGradient(0, 0, 0, CARDUME_H)
    bg.addColorStop(0, '#0E4A66')
    bg.addColorStop(0.5, '#0A2E4E')
    bg.addColorStop(1, '#071A33')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CARDUME_W, CARDUME_H)

    // raios de luz
    for (const [x0, w] of [
      [CARDUME_W * 0.12, 90],
      [CARDUME_W * 0.38, 60],
      [CARDUME_W * 0.62, 110],
      [CARDUME_W * 0.85, 70],
    ] as const) {
      const sway = Math.sin(this.time * 0.4 + x0) * 24
      const g = ctx.createLinearGradient(x0 + sway, 0, x0 + sway + w, CARDUME_H)
      g.addColorStop(0, 'rgba(126,220,255,0.10)')
      g.addColorStop(1, 'rgba(126,220,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x0 + sway, 0)
      ctx.lineTo(x0 + sway + w, 0)
      ctx.lineTo(x0 + sway + w * 2.4, CARDUME_H)
      ctx.lineTo(x0 + sway + w * 1.2, CARDUME_H)
      ctx.closePath()
      ctx.fill()
    }

    // bolhas
    for (const b of this.bubbles) {
      ctx.strokeStyle = 'rgba(200,240,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(b.x + Math.sin(this.time + b.y * 0.03) * 4, b.y, b.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    // comida: peixinho dourado
    for (const food of this.foods) {
      ctx.save()
      ctx.translate(food.x, food.y)
      ctx.scale(food.vx > 0 ? 1 : -1, 1)
      withGlow(ctx, '#FFC53D', 6, () => {
        ctx.fillStyle = '#FFC53D'
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(-5, 0)
        ctx.lineTo(-8.5, -2.6)
        ctx.lineTo(-8.5, 2.6)
        ctx.closePath()
        ctx.fill()
      })
      ctx.restore()
    }

    // o cardume
    for (const f of this.fish) {
      const ang = Math.atan2(f.vy, f.vx)
      const wig = Math.sin(this.time * 14 + f.phase) * 0.16
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(ang + wig)
      ctx.fillStyle = `hsl(${f.hue} 85% 66%)`
      ctx.beginPath()
      ctx.ellipse(0, 0, 5.4, 2.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-4.8, 0)
      ctx.lineTo(-8.6, -2.8)
      ctx.lineTo(-8.6, 2.8)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(10,20,40,0.85)'
      ctx.beginPath()
      ctx.arc(2.6, -0.6, 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // peixões
    for (const pr of this.predators) {
      ctx.save()
      ctx.translate(pr.x, pr.y)
      ctx.rotate(pr.angle)
      const s = pr.size
      withGlow(ctx, 'rgba(242,82,193,0.4)', 10, () => {
        const body = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6)
        body.addColorStop(0, '#B84DC7')
        body.addColorStop(1, '#5E1B78')
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      })
      // cauda + barbatana
      ctx.fillStyle = '#8F2FA8'
      ctx.beginPath()
      ctx.moveTo(-s * 0.9, 0)
      ctx.lineTo(-s * 1.5, -s * 0.5)
      ctx.lineTo(-s * 1.5, s * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-s * 0.1, -s * 0.45)
      ctx.lineTo(s * 0.2, -s * 0.95)
      ctx.lineTo(s * 0.4, -s * 0.4)
      ctx.closePath()
      ctx.fill()
      // boca (abre ao morder)
      ctx.fillStyle = '#071A33'
      ctx.beginPath()
      ctx.moveTo(s, 0)
      const open = pr.bite > 0 ? 0.55 : 0.28
      ctx.lineTo(s * 0.55, -s * open * 0.5)
      ctx.lineTo(s * 0.55, s * open * 0.5)
      ctx.closePath()
      ctx.fill()
      // olho
      ctx.fillStyle = '#FFF9F0'
      ctx.beginPath()
      ctx.arc(s * 0.45, -s * 0.2, s * 0.14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.beginPath()
      ctx.arc(s * 0.5, -s * 0.2, s * 0.07, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // vida
      ctx.fillStyle = 'rgba(7,26,51,0.7)'
      ctx.fillRect(pr.x - s, pr.y - s - 8, s * 2, 4)
      ctx.fillStyle = '#55E07F'
      ctx.fillRect(pr.x - s, pr.y - s - 8, s * 2 * Math.max(pr.hp / pr.maxHp, 0), 4)
    }

    // indicador do alvo/órbita (só brilha se AINDA houver giro disponível)
    if (!this.over) {
      const orbit = this.orbitAtivo
      ctx.strokeStyle = orbit ? 'rgba(255,197,61,0.8)' : 'rgba(51,224,214,0.5)'
      ctx.lineWidth = orbit ? 2.5 : 1.5
      ctx.beginPath()
      ctx.arc(this.target.x, this.target.y, orbit ? 44 : 10, 0, Math.PI * 2)
      ctx.stroke()
      if (orbit) {
        ctx.strokeStyle = 'rgba(255,197,61,0.35)'
        ctx.beginPath()
        ctx.arc(this.target.x, this.target.y, 52 + Math.sin(this.time * 8) * 4, 0, Math.PI * 2)
        ctx.stroke()
        // anel de TEMPO do vórtice (esvazia em 10s)
        ctx.strokeStyle = '#FFC53D'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(
          this.target.x,
          this.target.y,
          60,
          -Math.PI / 2,
          -Math.PI / 2 + (this.orbitTempo / ORBITA_MAX_S) * Math.PI * 2,
        )
        ctx.stroke()
      }
      // medidor de giros no canto: bolinhas cheias/vazias + recarga
      for (let i = 0; i < MAX_GIROS; i++) {
        ctx.beginPath()
        ctx.arc(18 + i * 18, CARDUME_H - 18, 6, 0, Math.PI * 2)
        ctx.fillStyle = i < this.giros ? '#FFC53D' : 'rgba(255,249,240,0.15)'
        ctx.fill()
      }
      if (this.recarga > 0) {
        ctx.fillStyle = 'rgba(255,249,240,0.75)'
        ctx.font = 'bold 12px "Baloo 2 Variable", sans-serif'
        ctx.fillText(`${Math.ceil(this.recarga)}s`, 18 + MAX_GIROS * 18, CARDUME_H - 14)
      }
    }

    this.particles.draw(ctx)
    this.waves.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    drawVignette(ctx, CARDUME_W, CARDUME_H, 0.5)
  }
}
