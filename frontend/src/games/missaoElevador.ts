/**
 * Missão Elevador — o espião desce o prédio de elevador: recolha os
 * DOCUMENTOS das portas vermelhas, elimine os agentes e chegue à garagem.
 * Prédio limpo → próximo, mais alto e mais vigiado.
 * Controles: ←/→ anda; no elevador, ↑/↓ sobe/desce; espaço/botão = TIRO.
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

export const ELEV_W = 560
export const ELEV_H = 640

const FLOOR_H = 96
const SHAFT_X = ELEV_W / 2
const SHAFT_HALF = 40
const WALL = 26
const DOOR_XS = [86, 182, 378, 474]

interface Agent {
  x: number
  t: number // andar (0 = topo)
  dir: number
  shootTimer: number
  alive: boolean
}

interface Shot {
  x: number
  y: number
  vx: number
  mine: boolean
}

interface Door {
  x: number
  t: number
  kind: 'normal' | 'doc' | 'coletada'
}

export class MissaoElevadorGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()

  private floors = 8
  private px = ELEV_W / 2
  private pt = 0 // andar contínuo (0 = topo)
  private facing = 1
  private invuln = 0
  private fireTimer = 0
  touchShoot = false

  private elevT = 0
  private doors: Door[] = []
  private agents: Agent[] = []
  private shots: Shot[] = []
  private spawnTimer = 2

  private docsTotal = 5
  private docs = 0
  private points = 0
  private lives = 3
  private building = 1
  private time = 0
  private over = false
  private overDelay = 0

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.buildBuilding()
    this.pushHud()
  }

  triggerShoot() {
    this.touchShoot = true
  }

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      lives: this.lives,
      weapon: `📁 ${this.docs}/${this.docsTotal} · prédio ${this.building}`,
    })
  }

  private groundY(t: number) {
    return 70 + (t + 1) * FLOOR_H
  }

  private buildBuilding() {
    this.floors = Math.min(7 + this.building, 12)
    this.docsTotal = Math.min(4 + this.building, 8)
    this.docs = 0
    this.px = ELEV_W / 2
    this.pt = 0
    this.elevT = 0
    this.agents = []
    this.shots = []
    this.doors = []
    // portas em todos os andares (menos a garagem); sorteia as vermelhas
    const spots: Array<{ x: number; t: number }> = []
    for (let t = 0; t < this.floors - 1; t++) {
      for (const x of DOOR_XS) spots.push({ x, t })
    }
    const shuffled = spots.sort(() => rand(-1, 1))
    shuffled.forEach((s, i) => {
      this.doors.push({ x: s.x, t: s.t, kind: i < this.docsTotal && s.t > 0 ? 'doc' : 'normal' })
    })
    // garante o total (caso os primeiros caíssem no andar 0)
    const reds = this.doors.filter((d) => d.kind === 'doc').length
    for (let i = 0; reds + i < this.docsTotal; ) {
      const cand = this.doors.find((d) => d.kind === 'normal' && d.t > 0)
      if (!cand) break
      cand.kind = 'doc'
      i++
    }
    this.spawnTimer = 2
  }

  private aboard(): boolean {
    return Math.abs(this.px - SHAFT_X) < SHAFT_HALF - 6 && Math.abs(this.pt - this.elevT) < 0.08
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    if (this.invuln > 0) this.invuln -= dt
    if (this.fireTimer > 0) this.fireTimer -= dt

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    const a = this.input.axis()
    let move = a.x
    if (this.input.pointer) move = clamp((this.input.pointer.x - this.px) / 60, -1, 1)
    if (Math.abs(move) > 0.15) this.facing = Math.sign(move)

    const onElev = this.aboard()
    if (onElev && Math.abs(a.y) > 0) {
      // dirige o elevador
      this.elevT = clamp(this.elevT + a.y * 1.4 * dt, 0, this.floors - 1)
      this.pt = this.elevT
      this.px = SHAFT_X
    } else {
      // anda pelo andar (o poço bloqueia se o elevador não estiver aqui)
      this.pt = Math.round(this.pt)
      const nx = clamp(this.px + move * 190 * dt, WALL + 12, ELEV_W - WALL - 12)
      const elevHere = Math.abs(this.elevT - this.pt) < 0.08
      const crossesShaft = Math.abs(nx - SHAFT_X) < SHAFT_HALF - 8
      if (!crossesShaft || elevHere) this.px = nx
      else this.px = this.px < SHAFT_X ? SHAFT_X - SHAFT_HALF + 8 : SHAFT_X + SHAFT_HALF - 8
    }

    // recolhe documento ao passar na porta vermelha
    for (const d of this.doors) {
      if (d.kind !== 'doc' || d.t !== Math.round(this.pt)) continue
      if (Math.abs(d.x - this.px) < 16) {
        d.kind = 'coletada'
        this.docs++
        this.points += 500
        this.texts.add(this.px, this.groundY(this.pt) - 70, '+500 📁', '#E8455A', 16)
        if (this.docs === this.docsTotal) {
          this.texts.add(ELEV_W / 2, 200, 'DESÇA À GARAGEM! 🚗', '#FFC53D', 22)
        }
        this.pushHud()
      }
    }

    // chegou à garagem com tudo → próximo prédio
    if (this.docs === this.docsTotal && Math.round(this.pt) === this.floors - 1) {
      this.points += 1000
      this.building++
      this.texts.add(ELEV_W / 2, 300, `PRÉDIO LIMPO! +1000`, '#FFC53D', 26)
      this.buildBuilding()
      this.pushHud()
      return
    }

    // tiro do espião
    const wantShoot = this.input.pressed(' ') || this.input.pressed('x') || this.touchShoot
    this.touchShoot = false
    if (wantShoot && this.fireTimer <= 0 && !onElev) {
      this.shots.push({ x: this.px + this.facing * 14, y: this.groundY(this.pt) - 26, vx: this.facing * 430, mine: true })
      this.fireTimer = 0.35
    }

    // agentes
    this.spawnTimer -= dt
    const aliveAgents = this.agents.filter((g) => g.alive).length
    if (this.spawnTimer <= 0 && aliveAgents < 2 + Math.min(this.building, 3)) {
      const myT = Math.round(this.pt)
      const doorPool = this.doors.filter((d) => Math.abs(d.t - myT) <= 1 && Math.abs(d.x - this.px) > 90)
      const door = doorPool[Math.floor(rand(0, doorPool.length))]
      if (door) {
        this.agents.push({ x: door.x, t: door.t, dir: Math.sign(this.px - door.x) || 1, shootTimer: rand(0.8, 1.6), alive: true })
      }
      this.spawnTimer = Math.max(2.4 - this.building * 0.2, 1)
    }
    for (const g of this.agents) {
      if (!g.alive) continue
      const sameFloor = g.t === Math.round(this.pt)
      if (sameFloor) g.dir = Math.sign(this.px - g.x) || g.dir
      g.x = clamp(g.x + g.dir * 80 * dt, WALL + 12, ELEV_W - WALL - 12)
      // não entra no poço
      if (Math.abs(g.x - SHAFT_X) < SHAFT_HALF - 4) {
        g.x = g.x < SHAFT_X ? SHAFT_X - SHAFT_HALF + 4 : SHAFT_X + SHAFT_HALF - 4
        g.dir *= -1
      }
      g.shootTimer -= dt
      if (sameFloor && g.shootTimer <= 0 && Math.abs(g.x - this.px) < 280) {
        this.shots.push({ x: g.x + g.dir * 12, y: this.groundY(g.t) - 26, vx: g.dir * 250, mine: false })
        g.shootTimer = rand(1.2, 2.2) - this.building * 0.08
      }
      // contato direto
      if (sameFloor && this.invuln <= 0 && Math.abs(g.x - this.px) < 18) this.hit()
    }

    // balas
    for (const s of this.shots) s.x += s.vx * dt
    this.shots = this.shots.filter((s) => s.x > WALL && s.x < ELEV_W - WALL)
    for (const s of this.shots) {
      if (s.mine) {
        for (const g of this.agents) {
          if (!g.alive || Math.abs(this.groundY(g.t) - 26 - s.y) > 30) continue
          if (Math.abs(g.x - s.x) < 14) {
            g.alive = false
            s.x = -999
            this.points += 100
            this.texts.add(g.x, s.y - 12, '+100', '#33E0D6', 14)
            for (let k = 0; k < 10; k++) {
              this.particles.list.push({
                x: g.x, y: s.y, vx: rand(-110, 110), vy: rand(-110, 110),
                life: rand(0.25, 0.5), maxLife: 0.5, color: '#9D5CFF', size: rand(2, 4),
              })
            }
            this.pushHud()
            break
          }
        }
      } else if (this.invuln <= 0) {
        const py = this.groundY(this.pt) - 26
        if (Math.abs(s.y - py) < 30 && Math.abs(s.x - this.px) < 12) {
          s.x = -999
          this.hit()
        }
      }
    }
    this.shots = this.shots.filter((s) => s.x > 0)
    this.agents = this.agents.filter((g) => g.alive)
  }

  private hit() {
    this.lives--
    this.invuln = 2
    this.shake.kick(10)
    this.pushHud()
    if (this.lives <= 0) {
      this.over = true
      this.overDelay = 1.2
    }
  }

  /* ---------------- desenho ---------------- */

  draw(ctx: CanvasRenderingContext2D) {
    // céu noturno atrás do prédio
    const sky = ctx.createLinearGradient(0, 0, 0, ELEV_H)
    sky.addColorStop(0, '#0E0A1F')
    sky.addColorStop(1, '#1B1235')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, ELEV_W, ELEV_H)

    const camY = clamp(this.groundY(this.pt) - ELEV_H * 0.55, 0, this.groundY(this.floors - 1) + 60 - ELEV_H)
    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y - camY)

    const bottom = this.groundY(this.floors - 1)

    // corpo do prédio
    ctx.fillStyle = '#231A3E'
    ctx.fillRect(WALL - 14, 40, ELEV_W - (WALL - 14) * 2, bottom - 20)
    ctx.fillStyle = '#171029'
    ctx.fillRect(WALL - 14, 28, ELEV_W - (WALL - 14) * 2, 16)

    for (let t = 0; t < this.floors; t++) {
      const y = this.groundY(t)
      const garage = t === this.floors - 1
      // laje
      ctx.fillStyle = '#3A2A6B'
      ctx.fillRect(WALL - 14, y, ELEV_W - (WALL - 14) * 2, 10)
      if (garage) {
        // garagem: carro da fuga
        ctx.fillStyle = 'rgba(51,224,214,0.12)'
        ctx.fillRect(WALL - 14, y - FLOOR_H + 10, ELEV_W - (WALL - 14) * 2, FLOOR_H - 10)
        withGlow(ctx, '#33E0D6', 8, () => {
          ctx.fillStyle = '#33E0D6'
          ctx.beginPath()
          ctx.roundRect(70, y - 30, 74, 20, 8)
          ctx.fill()
          ctx.beginPath()
          ctx.roundRect(88, y - 44, 38, 16, 6)
          ctx.fill()
          ctx.fillStyle = '#140E26'
          ctx.beginPath()
          ctx.arc(86, y - 8, 7, 0, Math.PI * 2)
          ctx.arc(128, y - 8, 7, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.font = '800 12px "Baloo 2 Variable", sans-serif'
        ctx.fillStyle = '#33E0D6'
        ctx.textAlign = 'center'
        ctx.fillText('GARAGEM', 107, y - 56)
      }
      // portas
      for (const d of this.doors.filter((dd) => dd.t === t)) {
        const dy = y - 52
        const color = d.kind === 'doc' ? '#E8455A' : d.kind === 'coletada' ? '#4A4160' : '#4A5BD4'
        if (d.kind === 'doc') {
          withGlow(ctx, '#E8455A', 8, () => this.door(ctx, d.x, dy, color))
        } else {
          this.door(ctx, d.x, dy, color)
        }
      }
      // luminárias
      ctx.fillStyle = 'rgba(255,197,61,0.5)'
      ctx.fillRect(120, y - FLOOR_H + 16, 24, 4)
      ctx.fillRect(ELEV_W - 144, y - FLOOR_H + 16, 24, 4)
    }

    // poço do elevador
    ctx.fillStyle = '#120C24'
    ctx.fillRect(SHAFT_X - SHAFT_HALF, 44, SHAFT_HALF * 2, bottom - 34)
    ctx.strokeStyle = '#5A3DA8'
    ctx.lineWidth = 3
    ctx.strokeRect(SHAFT_X - SHAFT_HALF, 44, SHAFT_HALF * 2, bottom - 34)
    ctx.setLineDash([6, 10])
    ctx.strokeStyle = 'rgba(157,92,255,0.4)'
    ctx.beginPath()
    ctx.moveTo(SHAFT_X - SHAFT_HALF + 8, 44)
    ctx.lineTo(SHAFT_X - SHAFT_HALF + 8, bottom)
    ctx.moveTo(SHAFT_X + SHAFT_HALF - 8, 44)
    ctx.lineTo(SHAFT_X + SHAFT_HALF - 8, bottom)
    ctx.stroke()
    ctx.setLineDash([])

    // cabine
    const ey = this.groundY(this.elevT)
    withGlow(ctx, '#FFC53D', 8, () => {
      ctx.fillStyle = '#3A2A6B'
      ctx.fillRect(SHAFT_X - SHAFT_HALF + 6, ey - 62, SHAFT_HALF * 2 - 12, 62)
      ctx.fillStyle = '#FFC53D'
      ctx.fillRect(SHAFT_X - SHAFT_HALF + 6, ey - 6, SHAFT_HALF * 2 - 12, 6)
      ctx.strokeStyle = '#FFC53D'
      ctx.lineWidth = 2
      ctx.strokeRect(SHAFT_X - SHAFT_HALF + 6, ey - 62, SHAFT_HALF * 2 - 12, 62)
    })

    // agentes
    for (const g of this.agents) {
      if (g.alive) this.person(ctx, g.x, this.groundY(g.t), '#4A4160', '#2A2140', g.dir)
    }

    // balas
    for (const s of this.shots) {
      withGlow(ctx, s.mine ? '#33E0D6' : '#F252C1', 8, () => {
        ctx.fillStyle = s.mine ? '#7CF5EC' : '#F252C1'
        ctx.fillRect(s.x - 5, s.y - 2, 10, 4)
      })
    }

    // espião (pisca quando invulnerável)
    if (this.invuln <= 0 || Math.floor(this.time * 10) % 2 === 0) {
      this.person(ctx, this.px, this.groundY(this.pt), '#9D5CFF', '#5A3DA8', this.facing, true)
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()
    drawVignette(ctx, ELEV_W, ELEV_H, 0.4)
  }

  private door(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x - 14, y, 28, 52, 4)
    ctx.fill()
    ctx.fillStyle = 'rgba(20,14,38,0.4)'
    ctx.beginPath()
    ctx.roundRect(x - 9, y + 6, 18, 18, 3)
    ctx.fill()
    ctx.fillStyle = '#FFC53D'
    ctx.beginPath()
    ctx.arc(x + 8, y + 30, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  private person(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    suit: string,
    dark: string,
    dir: number,
    spy = false,
  ) {
    const run = Math.sin(this.time * 11 + x * 0.1) * 4
    ctx.save()
    ctx.translate(x, groundY)
    ctx.strokeStyle = dark
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.moveTo(0, -12)
    ctx.lineTo(-4 + run * 0.4, 0)
    ctx.moveTo(0, -12)
    ctx.lineTo(4 - run * 0.4, 0)
    ctx.stroke()
    const g = ctx.createLinearGradient(0, -40, 0, -8)
    g.addColorStop(0, suit)
    g.addColorStop(1, dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(-8, -40, 16, 30, 5)
    ctx.fill()
    // arma apontada
    ctx.fillStyle = '#171029'
    ctx.fillRect(dir > 0 ? 6 : -16, -30, 10, 3.5)
    // cabeça + chapéu
    ctx.fillStyle = '#FFD9B8'
    ctx.beginPath()
    ctx.arc(0, -46, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = spy ? dark : '#171029'
    ctx.beginPath()
    ctx.ellipse(0, -50, 9.5, 3, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(-6, -55, 12, 5)
    if (spy) {
      // óculos escuros de espião
      ctx.fillStyle = '#140E26'
      ctx.fillRect(dir > 0 ? -2 : -6, -48, 8, 3)
    }
    ctx.restore()
  }
}
