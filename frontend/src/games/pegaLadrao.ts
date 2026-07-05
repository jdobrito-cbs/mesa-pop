/**
 * Pega-Ladrão — o guarda persegue o ladrão pelos andares da loja:
 * escadas rolantes nas pontas, carrinhos de compras rolando (PULE),
 * bolas quicando e aviõezinhos de brinquedo (ABAIXE). Alcance o ladrão
 * antes do tempo acabar — cada segundo que sobra vira ponto!
 * Controles: ←/→ ou arraste; ↑/botão = PULAR; ↓/botão = ABAIXAR.
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
  type GameHost,
} from '../engine/core'

export const PEGA_W = 560
export const PEGA_H = 560

const WORLD_W = 1500
const FLOORS = 4
const FLOOR_H = 110
const FLOOR_Y = (f: number) => PEGA_H - 40 - f * FLOOR_H // y do CHÃO do andar
const ESCALATOR_W = 90

interface Hazard {
  kind: 'carrinho' | 'bola' | 'aviao'
  floor: number
  x: number
  vx: number
  phase: number
}

export class PegaLadraoGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()

  // guarda
  private x = 120
  private floor = 0
  private vy = 0
  private jumpY = 0 // altura acima do chão
  private ducking = false
  private stunned = 0
  private onEscalator: { dir: 1; progress: number } | null = null

  // ladrão
  private tx = 700
  private tFloor = 1
  private tOnEscalator: { progress: number } | null = null
  private escaped = false

  private hazards: Hazard[] = []
  private spawnTimer = 1.4

  private timeLeft = 60
  private points = 0
  private lives = 3
  private round = 1
  private time = 0
  private over = false
  private overDelay = 0
  touchJump = false
  private duckTimer = 0

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.pushHud()
  }

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      lives: this.lives,
      weapon: `⏱ ${Math.max(Math.ceil(this.timeLeft), 0)}s · rodada ${this.round}`,
    })
  }

  triggerJump() {
    this.touchJump = true
  }

  /** botão de toque: abaixa por um instante */
  triggerDuck() {
    this.duckTimer = 0.8
  }

  /** escada rolante de cada andar fica na ponta OPOSTA à anterior */
  private escalatorX(f: number): number {
    return f % 2 === 0 ? WORLD_W - ESCALATOR_W - 30 : 30 + ESCALATOR_W
  }

  private resetRound(nextRound: boolean) {
    if (nextRound) this.round++
    this.x = 120
    this.floor = 0
    this.jumpY = 0
    this.vy = 0
    this.onEscalator = null
    this.tx = 620 + rand(0, 200)
    this.tFloor = 1
    this.tOnEscalator = null
    this.escaped = false
    this.hazards = []
    this.timeLeft = Math.max(60 - (this.round - 1) * 4, 40)
    this.stunned = 0
    this.pushHud()
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    this.timeLeft -= dt
    if (Math.ceil(this.timeLeft) !== Math.ceil(this.timeLeft + dt)) this.pushHud()
    if (this.timeLeft <= 0) {
      this.fail('O tempo acabou!')
      return
    }

    // ---- guarda ----
    if (this.stunned > 0) this.stunned -= dt
    const a = this.input.axis()
    let move = a.x
    if (this.input.pointer) move = clamp((this.input.pointer.x - PEGA_W / 2) / 80, -1, 1)
    if (this.duckTimer > 0) this.duckTimer -= dt
    const wantJump = a.y < 0 || this.input.pressed(' ') || this.touchJump
    this.ducking = (a.y > 0 || this.duckTimer > 0) && this.jumpY === 0
    this.touchJump = false

    if (this.onEscalator) {
      // sobe a escada automaticamente
      this.onEscalator.progress += dt * 1.6
      if (this.onEscalator.progress >= 1) {
        this.floor++
        this.onEscalator = null
      }
    } else if (this.stunned <= 0) {
      const speed = this.ducking ? 90 : 210
      this.x = clamp(this.x + move * speed * dt, 30, WORLD_W - 30)
      // pulo
      if (wantJump && this.jumpY === 0) this.vy = 300
      // entra na escada rolante andando até a ponta dela
      const ex = this.escalatorX(this.floor)
      if (this.floor < FLOORS - 1 && Math.abs(this.x - ex) < 16 && this.jumpY === 0) {
        this.onEscalator = { dir: 1, progress: 0 }
      }
    }
    if (this.vy !== 0 || this.jumpY > 0) {
      this.jumpY += this.vy * dt
      this.vy -= 900 * dt
      if (this.jumpY <= 0) {
        this.jumpY = 0
        this.vy = 0
      }
    }

    // ---- ladrão: corre para a escada do andar dele ----
    if (!this.escaped) {
      if (this.tOnEscalator) {
        this.tOnEscalator.progress += dt * 1.6
        if (this.tOnEscalator.progress >= 1) {
          this.tFloor++
          this.tOnEscalator = null
          if (this.tFloor >= FLOORS) {
            this.escaped = true
            this.fail('O ladrão fugiu pelo telhado!')
            return
          }
        }
      } else {
        const ex = this.escalatorX(this.tFloor)
        const tSpeed = 120 + this.round * 12
        this.tx += Math.sign(ex - this.tx) * tSpeed * dt
        if (Math.abs(this.tx - ex) < 10) this.tOnEscalator = { progress: 0 }
      }
    }

    // pegou!
    if (
      this.floor === this.tFloor &&
      !this.onEscalator &&
      !this.tOnEscalator &&
      Math.abs(this.x - this.tx) < 26
    ) {
      const bonus = Math.ceil(this.timeLeft) * 20 + 500
      this.points += bonus
      this.texts.add(PEGA_W / 2, 120, `PEGOU! +${bonus}`, '#FFC53D', 26)
      this.shake.kick(6)
      this.resetRound(true)
      return
    }

    // ---- obstáculos ----
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      const kind = (['carrinho', 'bola', 'aviao'] as const)[Math.floor(rand(0, 3))]!
      const floor = Math.floor(rand(0, FLOORS))
      const fromLeft = rand(0, 1) < 0.5
      this.hazards.push({
        kind,
        floor,
        x: fromLeft ? -30 : WORLD_W + 30,
        vx: (fromLeft ? 1 : -1) * (kind === 'aviao' ? 240 : kind === 'carrinho' ? 170 : 130) * (1 + this.round * 0.06),
        phase: rand(0, Math.PI * 2),
      })
      this.spawnTimer = Math.max(1.6 - this.round * 0.1, 0.7)
    }
    for (const h of this.hazards) {
      h.x += h.vx * dt
      h.phase += dt * 6
    }
    this.hazards = this.hazards.filter((h) => h.x > -60 && h.x < WORLD_W + 60)

    // colisão com o guarda
    if (this.stunned <= 0 && !this.onEscalator) {
      for (const h of this.hazards) {
        if (h.floor !== this.floor || Math.abs(h.x - this.x) > 20) continue
        const low = h.kind === 'carrinho' || (h.kind === 'bola' && Math.sin(h.phase) < 0.2)
        const high = h.kind === 'aviao'
        const dodged = (low && this.jumpY > 24) || (high && this.ducking)
        if (!dodged) {
          this.stunned = 1.4
          this.timeLeft = Math.max(this.timeLeft - 8, 1)
          this.shake.kick(8)
          this.texts.add(PEGA_W / 2, 140, '−8s!', '#E8455A', 20)
          this.pushHud()
          break
        }
      }
    }
  }

  private fail(msg: string) {
    this.lives--
    this.texts.add(PEGA_W / 2, PEGA_H / 2 - 60, msg, '#E8455A', 20)
    this.shake.kick(10)
    this.pushHud()
    if (this.lives <= 0) {
      this.over = true
      this.overDelay = 1.4
    } else {
      this.resetRound(false)
    }
  }

  /* ---------------- desenho ---------------- */

  draw(ctx: CanvasRenderingContext2D) {
    // câmera segue o guarda
    const cam = clamp(this.x - PEGA_W / 2, 0, WORLD_W - PEGA_W)

    // parede de fundo da loja
    const bg = ctx.createLinearGradient(0, 0, 0, PEGA_H)
    bg.addColorStop(0, '#241849')
    bg.addColorStop(1, '#191033')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, PEGA_W, PEGA_H)

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x - cam, off.y)

    // andares
    for (let f = 0; f < FLOORS; f++) {
      const y = FLOOR_Y(f)
      // vitrines de fundo
      for (let vx = 60; vx < WORLD_W; vx += 180) {
        const hue = ['#2E2058', '#31255E', '#2A1E52'][(vx / 180) % 3 | 0]!
        ctx.fillStyle = hue
        ctx.fillRect(vx, y - 82, 120, 70)
        ctx.fillStyle = 'rgba(157,92,255,0.16)'
        ctx.fillRect(vx + 6, y - 76, 108, 44)
        // manequim/prateleira
        ctx.fillStyle = 'rgba(244,239,255,0.18)'
        ctx.beginPath()
        ctx.arc(vx + 30 + ((vx / 180) % 3 | 0) * 20, y - 48, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(vx + 60, y - 46, 40, 22)
      }
      // piso
      const g = ctx.createLinearGradient(0, y, 0, y + 14)
      g.addColorStop(0, '#5A3DA8')
      g.addColorStop(1, '#3A2472')
      ctx.fillStyle = g
      ctx.fillRect(0, y, WORLD_W, 14)
      // escada rolante (listras diagonais subindo)
      if (f < FLOORS - 1) {
        const ex = this.escalatorX(f)
        const topY = FLOOR_Y(f + 1)
        ctx.strokeStyle = '#33E0D6'
        ctx.lineWidth = 5
        const dir = f % 2 === 0 ? -1 : 1
        ctx.beginPath()
        ctx.moveTo(ex, y)
        ctx.lineTo(ex + dir * ESCALATOR_W, topY + 14)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(51,224,214,0.35)'
        for (let s = 0; s < 5; s++) {
          const t = s / 5 + ((this.time * 0.4) % 0.2)
          const sx = ex + dir * ESCALATOR_W * t
          const sy = y + (topY + 14 - y) * t
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + 14, sy)
          ctx.stroke()
        }
      }
    }
    // telhado (fuga do ladrão)
    ctx.fillStyle = '#171029'
    ctx.fillRect(0, FLOOR_Y(FLOORS - 1) - 96, WORLD_W, 8)

    // obstáculos
    for (const h of this.hazards) this.drawHazard(ctx, h)

    // ladrão
    if (!this.escaped) {
      const ty = this.thiefY()
      this.drawThief(ctx, this.tx, ty)
    }

    // guarda
    this.drawCop(ctx)

    this.particles.draw(ctx)
    ctx.restore()
    this.texts.draw(ctx)
    drawVignette(ctx, PEGA_W, PEGA_H, 0.35)
  }

  private thiefY(): number {
    if (this.tOnEscalator) {
      const from = FLOOR_Y(this.tFloor)
      const to = FLOOR_Y(this.tFloor + 1)
      return from + (to - from) * this.tOnEscalator.progress
    }
    return FLOOR_Y(this.tFloor)
  }

  private copY(): number {
    if (this.onEscalator) {
      const from = FLOOR_Y(this.floor)
      const to = FLOOR_Y(this.floor + 1)
      return from + (to - from) * this.onEscalator.progress
    }
    return FLOOR_Y(this.floor) - this.jumpY
  }

  private drawCop(ctx: CanvasRenderingContext2D) {
    const y = this.copY()
    const blink = this.stunned > 0 && Math.floor(this.time * 10) % 2 === 0
    if (blink) return
    const run = Math.sin(this.time * 12) * 5
    const h = this.ducking ? 26 : 40
    ctx.save()
    ctx.translate(this.x, y)
    // pernas correndo
    ctx.strokeStyle = '#2A2140'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(0, -12)
    ctx.lineTo(-5 + run * 0.5, 0)
    ctx.moveTo(0, -12)
    ctx.lineTo(5 - run * 0.5, 0)
    ctx.stroke()
    // corpo azul de guarda
    const g = ctx.createLinearGradient(0, -h, 0, 0)
    g.addColorStop(0, '#4A5BD4')
    g.addColorStop(1, '#32409E')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(-9, -h, 18, h - 8, 6)
    ctx.fill()
    // cabeça + quepe
    ctx.fillStyle = '#FFD9B8'
    ctx.beginPath()
    ctx.arc(0, -h - 7, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#32409E'
    ctx.beginPath()
    ctx.arc(0, -h - 10, 8.5, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(-8.5, -h - 11, 17, 3)
    withGlow(ctx, '#FFC53D', 6, () => {
      ctx.fillStyle = '#FFC53D'
      ctx.beginPath()
      ctx.arc(0, -h - 12, 2.2, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  }

  private drawThief(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const run = Math.sin(this.time * 14) * 6
    ctx.save()
    ctx.translate(x, y)
    ctx.strokeStyle = '#171029'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(0, -12)
    ctx.lineTo(-6 + run * 0.5, 0)
    ctx.moveTo(0, -12)
    ctx.lineTo(6 - run * 0.5, 0)
    ctx.stroke()
    // listras de presidiário
    for (let s = 0; s < 4; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#F4EFFF' : '#2A2140'
      ctx.fillRect(-9, -40 + s * 8, 18, 8)
    }
    // saco de dinheiro
    withGlow(ctx, '#FFC53D', 5, () => {
      ctx.fillStyle = '#C78B0A'
      ctx.beginPath()
      ctx.arc(-14, -30 + run * 0.4, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFC53D'
      ctx.font = '800 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('$', -14, -27 + run * 0.4)
    })
    // cabeça com máscara
    ctx.fillStyle = '#FFD9B8'
    ctx.beginPath()
    ctx.arc(0, -47, 7.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2A2140'
    ctx.fillRect(-7.5, -51, 15, 5)
    ctx.fillStyle = '#F4EFFF'
    ctx.beginPath()
    ctx.arc(-3, -48.5, 1.5, 0, Math.PI * 2)
    ctx.arc(3, -48.5, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawHazard(ctx: CanvasRenderingContext2D, h: Hazard) {
    const floorY = FLOOR_Y(h.floor)
    ctx.save()
    if (h.kind === 'carrinho') {
      ctx.translate(h.x, floorY)
      ctx.strokeStyle = '#B4A8D8'
      ctx.lineWidth = 3
      ctx.strokeRect(-14, -22, 28, 14)
      ctx.beginPath()
      ctx.moveTo(-14, -22)
      ctx.lineTo(-20, -30)
      ctx.stroke()
      ctx.fillStyle = '#2A2140'
      ctx.beginPath()
      ctx.arc(-8, -4, 4, 0, Math.PI * 2)
      ctx.arc(8, -4, 4, 0, Math.PI * 2)
      ctx.fill()
    } else if (h.kind === 'bola') {
      const by = floorY - 8 - Math.abs(Math.sin(h.phase)) * 46
      ctx.translate(h.x, by)
      withGlow(ctx, '#F252C1', 6, () => {
        ctx.fillStyle = '#F252C1'
        ctx.beginPath()
        ctx.arc(0, 0, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#FFF9F0'
        ctx.beginPath()
        ctx.arc(0, 0, 9, -0.6, 0.9)
        ctx.arc(0, 0, 4, 0.9, -0.6, true)
        ctx.fill()
      })
    } else {
      const ay = floorY - 52 + Math.sin(h.phase * 0.7) * 5
      ctx.translate(h.x, ay)
      ctx.scale(Math.sign(h.vx), 1)
      ctx.fillStyle = '#FF8244'
      ctx.beginPath()
      ctx.roundRect(-16, -4, 32, 8, 4)
      ctx.fill()
      ctx.fillRect(-4, -10, 8, 8)
      ctx.fillStyle = '#FFC53D'
      ctx.beginPath()
      ctx.moveTo(-16, 0)
      ctx.lineTo(-24, -6)
      ctx.lineTo(-24, 6)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}
