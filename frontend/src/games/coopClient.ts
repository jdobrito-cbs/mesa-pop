/**
 * Cliente do Esquadrão 42 Co-op.
 * O servidor simula o mundo; aqui a gente:
 * - move o PRÓPRIO avião localmente (zero latência) e reporta a posição;
 * - interpola inimigos/parceiro entre snapshots (~10Hz) e avança balas
 *   por dead-reckoning;
 * - toca os efeitos (explosões, textos, shake) vindos como eventos.
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
import {
  COOP_H,
  COOP_W,
  type CoopAction,
  type CoopPlane,
  type CoopSnapshot,
} from '@mesapop/shared'

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

interface StampedSnapshot {
  snap: CoopSnapshot
  at: number
}

export interface CoopHud {
  planes: CoopPlane[]
  yourSeat: number
  mode: CoopSnapshot['mode']
}

export class CoopClientView implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private waves = new Shockwaves()
  private shake = new ScreenShake()
  private prev: StampedSnapshot | null = null
  private next: StampedSnapshot | null = null
  private local = { x: COOP_W / 2, y: COOP_H - 90 }
  private localVx = 0
  private scroll = 0
  private sendTimer = 0
  private time = 0
  private cloudsNear = Array.from({ length: 5 }, () => ({
    x: rand(0, COOP_W),
    y: rand(0, COOP_H),
    r: rand(26, 55),
  }))

  constructor(
    public yourSeat: number,
    private send: (action: CoopAction) => void,
    private onHud: (hud: CoopHud) => void,
  ) {}

  get finished() {
    return this.next?.snap.finished ?? false
  }

  pushSnapshot(snap: CoopSnapshot) {
    this.prev = this.next
    this.next = { snap, at: performance.now() }
    this.scroll = snap.scroll

    // efeitos disparados pelo servidor
    for (const ev of snap.events) {
      if (ev.kind === 'explosion') {
        this.particles.burst(ev.x, ev.y, '#FF8244', 16, 200)
        this.waves.add(ev.x, ev.y, 34, '#FF8244')
      } else if (ev.kind === 'big-explosion') {
        this.particles.burst(ev.x, ev.y, '#FF8244', 26, 260)
        this.particles.burst(ev.x, ev.y, '#FFC53D', 14, 150)
        this.waves.add(ev.x, ev.y, 80, '#FFC53D')
      } else if (ev.kind === 'text') {
        this.texts.add(ev.x, ev.y, ev.text ?? '', ev.color ?? '#F4EFFF', 15)
      } else if (ev.kind === 'shake') {
        this.shake.kick(10)
      }
    }

    const mine = snap.planes[this.yourSeat]
    if (mine && (mine.downed || !mine.alive)) {
      // derrubado: o servidor manda; trava o avião local nele
      this.local.x = mine.x
      this.local.y = mine.y
    }
    this.onHud({ planes: snap.planes, yourSeat: this.yourSeat, mode: snap.mode })
  }

  triggerBomb() {
    this.send({ type: 'bomb' })
  }
  triggerLoop() {
    this.send({ type: 'loop' })
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.waves.update(dt)
    this.shake.update(dt)
    this.scroll += 95 * dt
    for (const c of this.cloudsNear) {
      c.y += 70 * dt
      if (c.y - c.r > COOP_H) {
        c.y = -c.r
        c.x = rand(0, COOP_W)
      }
    }

    const mine = this.next?.snap.planes[this.yourSeat]
    const canMove = !this.finished && mine && mine.alive && !mine.downed
    if (canMove) {
      const speed = 280
      const axis = this.input.axis()
      let dx = axis.x * speed * dt
      let dy = axis.y * speed * dt
      if (this.input.pointer) {
        const px = this.input.pointer.x - this.local.x
        const py = this.input.pointer.y - 40 - this.local.y
        const dist = Math.hypot(px, py)
        if (dist > 4) {
          const v = Math.min(speed * 1.2, dist * 10)
          dx += (px / dist) * v * dt
          dy += (py / dist) * v * dt
        }
      }
      this.local.x = clamp(this.local.x + dx, 14, COOP_W - 14)
      this.local.y = clamp(this.local.y + dy, 30, COOP_H - 20)
      this.localVx = dx / Math.max(dt, 0.001)

      this.sendTimer -= dt
      if (this.sendTimer <= 0) {
        this.send({ type: 'pos', x: this.local.x, y: this.local.y })
        this.sendTimer = 0.06
      }
    }
  }

  /* ---------- interpolação ---------- */

  private lerpFactor(): number {
    if (!this.prev || !this.next) return 1
    const span = this.next.at - this.prev.at || 100
    return clamp((performance.now() - this.next.at) / span + 1, 0, 1.35)
  }

  private lerpBy<T extends { id: number; x: number; y: number }>(
    prevList: T[] | undefined,
    nextList: T[],
    f: number,
  ): T[] {
    if (!prevList) return nextList
    const prevById = new Map(prevList.map((e) => [e.id, e]))
    return nextList.map((e) => {
      const p = prevById.get(e.id)
      if (!p) return e
      return { ...e, x: p.x + (e.x - p.x) * f, y: p.y + (e.y - p.y) * f }
    })
  }

  /* ---------- desenho ---------- */

  draw(ctx: CanvasRenderingContext2D) {
    this.drawTerrain(ctx)
    const snap = this.next?.snap
    if (!snap) {
      drawVignette(ctx, COOP_W, COOP_H, 0.4)
      return
    }
    const f = this.lerpFactor()
    const age = (performance.now() - (this.next?.at ?? 0)) / 1000

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    for (const g of this.lerpBy(this.prev?.snap.ground, snap.ground, f)) {
      this.drawGroundEnemy(ctx, g)
    }

    // power-ups
    for (const p of this.lerpBy(this.prev?.snap.powerups, snap.powerups, f)) {
      this.drawPowerup(ctx, p)
    }

    for (const e of this.lerpBy(this.prev?.snap.air, snap.air, f)) {
      this.drawAirEnemy(ctx, e)
    }
    if (snap.boss) this.drawBoss(ctx, snap.boss)

    // balas: dead reckoning a partir do último snapshot
    for (const b of snap.bullets) {
      const bx = b.x + b.vx * age
      const by = b.y + b.vy * age
      withGlow(ctx, b.color, 8, () => {
        ctx.fillStyle = b.color
        if (b.homing) {
          ctx.save()
          ctx.translate(bx, by)
          ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2)
          ctx.beginPath()
          ctx.roundRect(-2.5, -8, 5, 15, 2.5)
          ctx.fill()
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.roundRect(bx - b.r / 2, by - b.r * 1.8, b.r, b.r * 3.4, b.r / 2)
          ctx.fill()
        }
      })
    }
    for (const b of snap.enemyBullets) {
      const bx = b.x + b.vx * age
      const by = b.y + b.vy * age
      withGlow(ctx, b.color, 9, () => {
        const g = ctx.createRadialGradient(bx, by, 0.5, bx, by, b.r)
        g.addColorStop(0, '#FFF9F0')
        g.addColorStop(1, b.color)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(bx, by, b.r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // aviões: o meu usa a posição LOCAL; o parceiro interpola
    for (const plane of snap.planes) {
      const isMe = plane.seat === this.yourSeat
      let px = plane.x
      let py = plane.y
      if (isMe && plane.alive && !plane.downed) {
        px = this.local.x
        py = this.local.y
      } else if (!isMe && this.prev) {
        const before = this.prev.snap.planes[plane.seat]
        if (before) {
          px = before.x + (plane.x - before.x) * f
          py = before.y + (plane.y - before.y) * f
        }
      }
      this.drawPlane(ctx, plane, px, py, isMe)
    }

    this.particles.draw(ctx)
    this.waves.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    // barra de vida do boss
    if (snap.boss && snap.boss.dying <= 0) {
      const w = COOP_W - 60
      ctx.fillStyle = 'rgba(20,14,38,0.75)'
      ctx.beginPath()
      ctx.roundRect(30, 12, w, 10, 5)
      ctx.fill()
      const grad = ctx.createLinearGradient(30, 0, 30 + w, 0)
      grad.addColorStop(0, '#FF8244')
      grad.addColorStop(1, '#F252C1')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(30, 12, Math.max(w * (snap.boss.hp / snap.boss.maxHp), 6), 10, 5)
      ctx.fill()
    }

    // nuvens por cima
    for (const c of this.cloudsNear) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.4)
      g.addColorStop(0, 'rgba(244,239,255,0.16)')
      g.addColorStop(1, 'rgba(244,239,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.r * 1.5, c.r * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    drawVignette(ctx, COOP_W, COOP_H, 0.4)
  }

  private roadX(y: number) {
    return COOP_W * 0.62 + Math.sin((y + this.scroll) * 0.005) * 26
  }

  private drawTerrain(ctx: CanvasRenderingContext2D) {
    const BAND = 90
    const first = Math.floor(-this.scroll / BAND) - 1
    for (let k = first; k * BAND + this.scroll < COOP_H + BAND; k++) {
      const y = k * BAND + this.scroll
      const h1 = hash(k)
      const greens = ['#2E5D3A', '#2A5434', '#33663F', '#2C5936']
      ctx.fillStyle = greens[Math.floor(h1 * greens.length)]!
      ctx.fillRect(0, y, COOP_W, BAND + 1)
      if (h1 > 0.35) {
        ctx.fillStyle = 'rgba(255,197,61,0.10)'
        const px = hash(k * 3 + 1) * (COOP_W - 140)
        ctx.beginPath()
        ctx.roundRect(px, y + 12, 110 + hash(k * 7) * 60, BAND - 24, 10)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#3D3A4A'
    for (let y = -20; y < COOP_H + 20; y += 10) {
      ctx.fillRect(this.roadX(y) - 30, y, 60, 11)
    }
    for (let y = -20; y < COOP_H + 20; y += 10) {
      const rx = this.roadX(y)
      ctx.fillStyle = 'rgba(255,249,240,0.25)'
      ctx.fillRect(rx - 30, y, 2, 11)
      ctx.fillRect(rx + 28, y, 2, 11)
      if (Math.floor((y + this.scroll) / 26) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,249,240,0.5)'
        ctx.fillRect(rx - 1.5, y, 3, 11)
      }
    }
    for (let k = first; k * BAND + this.scroll < COOP_H + BAND; k++) {
      const y = k * BAND + this.scroll
      for (let i = 0; i < 3; i++) {
        const h = hash(k * 13 + i * 5)
        const tx = h * COOP_W
        const ty = y + hash(k * 17 + i) * BAND
        if (Math.abs(tx - this.roadX(ty)) < 52) continue
        if (h > 0.82) {
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

  private drawGroundEnemy(
    ctx: CanvasRenderingContext2D,
    g: CoopSnapshot['ground'][0],
  ) {
    ctx.save()
    ctx.translate(g.x, g.y)
    const flashing = g.flash > 0
    if (g.kind === 'carro') {
      if (g.lane < 0) ctx.rotate(Math.PI)
      ctx.fillStyle = 'rgba(20,14,38,0.3)'
      ctx.beginPath()
      ctx.roundRect(-7, -12, 16, 26, 5)
      ctx.fill()
      ctx.fillStyle = flashing ? '#FFFFFF' : g.color
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
      ctx.fillStyle = 'rgba(20,14,38,0.55)'
      ctx.fillRect(-14, -11, 5, 24)
      ctx.fillRect(9, -11, 5, 24)
      ctx.fillStyle = flashing ? '#FFF' : '#2C3A17'
      ctx.fillRect(0, -2.6, 20, 5.2)
      ctx.fillStyle = flashing ? '#FFF' : '#77925A'
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(20,14,38,0.7)'
      ctx.fillRect(-14, -18, 28, 3)
      ctx.fillStyle = '#55E07F'
      ctx.fillRect(-14, -18, 28 * (g.hp / g.maxHp), 3)
    }
    ctx.restore()
  }

  private drawAirEnemy(ctx: CanvasRenderingContext2D, e: CoopSnapshot['air'][0]) {
    ctx.fillStyle = 'rgba(20,14,38,0.22)'
    ctx.beginPath()
    ctx.ellipse(e.x + 12, e.y + 26, 12, 5, 0, 0, Math.PI * 2)
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
      ctx.fillStyle = flashing ? '#FFF' : '#C2188C'
      ctx.fillRect(-2, -20, 4, 12)
      ctx.fillRect(-7, -21, 14, 3)
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
    } else {
      const big = e.kind === 'aviao-grande'
      ctx.scale(big ? 1.7 : 1, big ? 1.7 : 1)
      const [light, dark] = big ? ['#B584FF', '#5B2BA8'] : ['#FFB08A', '#E85A1F']
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
      if (big) {
        ctx.fillStyle = 'rgba(20,14,38,0.7)'
        ctx.fillRect(-12, -16, 24, 2.4)
        ctx.fillStyle = '#55E07F'
        ctx.fillRect(-12, -16, 24 * (e.hp / e.maxHp), 2.4)
      }
    }
    ctx.restore()
  }

  private drawBoss(ctx: CanvasRenderingContext2D, boss: NonNullable<CoopSnapshot['boss']>) {
    ctx.fillStyle = 'rgba(20,14,38,0.28)'
    ctx.beginPath()
    ctx.ellipse(boss.x + 20, boss.y + 55, 80, 18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.translate(boss.x, boss.y)
    const flashing = boss.flash > 0 || boss.dying > 0
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
    ctx.restore()
  }

  private drawPowerup(ctx: CanvasRenderingContext2D, p: CoopSnapshot['powerups'][0]) {
    const colorMap: Record<string, string> = {
      vida: '#F252C1',
      bomba: '#FF8244',
      reto: '#F4EFFF',
      espalhado: '#FFC53D',
      laser: '#33E0D6',
      missil: '#F252C1',
    }
    const color = colorMap[p.kind] ?? '#F4EFFF'
    const pulse = 1 + Math.sin(p.t * 5) * 0.1
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.scale(pulse, pulse)
    withGlow(ctx, color, 14, () => {
      ctx.fillStyle = 'rgba(255,249,240,0.95)'
      ctx.beginPath()
      ctx.arc(0, 0, 13, 0, Math.PI * 2)
      ctx.fill()
    })
    const inner = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11)
    inner.addColorStop(0, '#FFFFFF')
    inner.addColorStop(1, color)
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(0, 0, 10, 0, Math.PI * 2)
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

  private drawPlane(
    ctx: CanvasRenderingContext2D,
    plane: CoopPlane,
    x: number,
    y: number,
    isMe: boolean,
  ) {
    if (!plane.alive) return
    const downed = plane.downed
    const blink = plane.invincible && Math.floor(this.time * 12) % 2 === 1
    if (blink && !downed) return

    // cores: eu = roxo; parceiro = ciano
    const [wingA, wingB, hullA, hullB] = isMe
      ? ['#6B37C4', '#B584FF', '#5B2BA8', '#A96FFF']
      : ['#177E77', '#5FEFE4', '#136B65', '#4FE0D4']

    if (!downed) {
      ctx.fillStyle = 'rgba(20,14,38,0.28)'
      ctx.beginPath()
      ctx.ellipse(x + 14, y + 30, 11, 5, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.save()
    ctx.translate(x, y)
    if (downed) {
      ctx.globalAlpha = 0.75
      ctx.rotate(Math.sin(this.time * 2) * 0.25)
    } else if (isMe) {
      const tilt = clamp(this.localVx / 1100, -0.3, 0.3)
      ctx.rotate(plane.looping ? this.time * 7 : tilt)
      ctx.scale(1 - Math.abs(clamp(this.localVx / 1100, -0.3, 0.3)) * 0.55, 1)
    }

    if (!downed) {
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
    } else {
      // fumaça do avião derrubado
      ctx.fillStyle = 'rgba(120,110,140,0.5)'
      for (let i = 0; i < 3; i++) {
        const sy = -6 - i * 8 - (this.time * 20) % 8
        ctx.beginPath()
        ctx.arc(Math.sin(this.time * 3 + i) * 4, sy, 4 + i * 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const wing = ctx.createLinearGradient(-18, 0, 18, 0)
    wing.addColorStop(0, wingA)
    wing.addColorStop(0.5, wingB)
    wing.addColorStop(1, wingA)
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

    const hull = ctx.createLinearGradient(-5, 0, 5, 0)
    hull.addColorStop(0, hullA)
    hull.addColorStop(0.5, hullB)
    hull.addColorStop(1, hullA)
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(0, -19)
    ctx.quadraticCurveTo(4.6, -8, 4.2, 8)
    ctx.quadraticCurveTo(3, 14, 0, 15)
    ctx.quadraticCurveTo(-3, 14, -4.2, 8)
    ctx.quadraticCurveTo(-4.6, -8, 0, -19)
    ctx.closePath()
    ctx.fill()

    const cockpit = ctx.createRadialGradient(-1, -8, 0.5, 0, -7, 5.5)
    cockpit.addColorStop(0, '#FFFFFF')
    cockpit.addColorStop(1, isMe ? '#33E0D6' : '#FFC53D')
    ctx.fillStyle = cockpit
    ctx.beginPath()
    ctx.ellipse(0, -7, 2.6, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // anel de reanimação
    if (downed && plane.revive > 0) {
      ctx.save()
      ctx.strokeStyle = '#55E07F'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + plane.revive * Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    if (downed) {
      ctx.save()
      ctx.font = '800 11px "Baloo 2 Variable", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FF8244'
      ctx.fillText(isMe ? 'aguarde o resgate!' : 'voe até ele!', x, y + 40)
      ctx.restore()
    }
  }
}
