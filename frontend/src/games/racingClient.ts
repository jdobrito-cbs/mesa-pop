/**
 * Cliente da Corrida Pop — terceira pessoa estilo Top Gear:
 * - CLIENT-SIDE PREDICTION: o próprio veículo roda a MESMA física do
 *   servidor localmente, com inputs numerados (seq);
 * - RECONCILIAÇÃO: quando o snapshot chega, partimos do estado do servidor
 *   e reaplicamos os inputs que ele ainda não processou (seq > lastAck);
 * - rivais são interpolados entre snapshots e projetados na pista;
 * - a pista é desenhada em pseudo-3D: fatias projetadas com perspectiva,
 *   curvas acumulando deslocamento horizontal e morros movendo o horizonte.
 */
import {
  clamp,
  rand,
  withGlow,
  FloatingTexts,
  Input,
  Particles,
  type GameHost,
} from '../engine/core'
import {
  curveAt,
  elevationAt,
  lapDistance,
  raceProgress,
  stepCar,
  trackLayout,
  CURVE_K,
  CURVE_SCALE,
  RACE_H,
  RACE_W,
  TRACK_LENGTH,
  TRACK_SEGMENTS,
  type CarInputState,
  type CarState,
  type RacingSnapshot,
  type VehicleKind,
} from '@mesapop/shared'

export const CAR_COLORS = [
  { body: '#F252C1', dark: '#A61B7E', name: 'Magenta' },
  { body: '#33E0D6', dark: '#128F86', name: 'Ciano' },
  { body: '#FFC53D', dark: '#C0850A', name: 'Amarelo' },
  { body: '#55E07F', dark: '#1E9A46', name: 'Verde' },
]

/* ------------- projeção ------------- */

const CY = Math.round(RACE_H * 0.32) // centro de fuga (horizonte)
const CAM_H = 58 // altura da câmera
const FOCAL = ((RACE_H - CY) * 14) / CAM_H // calibrado p/ 1ª fatia no rodapé
const SLICE = 14
const SLICES = 95
const ROAD_W = 70 // meia-largura da pista em unidades do mundo
const HILL_SCALE = 0.34
const CURVE_PX = 1.15
const CAM_BACK = 34 // câmera atrás do carro
const FOG = '#8a63c8'

interface SliceProj {
  y: number
  x: number
  half: number
  d: number // distância absoluta da fatia
  z: number
  hidden: boolean
}

interface Sprite {
  n: number
  draw: (ctx: CanvasRenderingContext2D) => void
}

interface Stamped {
  snap: RacingSnapshot
  at: number
}

export interface RaceHud {
  lap: number
  totalLaps: number
  boost: number
  speed: number
  position: number
  players: number
  phase: RacingSnapshot['phase']
  countdown: number
  finishOrder: number[]
  yourSeat: number
  vehicle: VehicleKind
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const
const FOG_RGB = hex(FOG)
function fogMix(c: readonly [number, number, number], t: number): string {
  const r = Math.round(c[0] + (FOG_RGB[0] - c[0]) * t)
  const g = Math.round(c[1] + (FOG_RGB[1] - c[1]) * t)
  const b = Math.round(c[2] + (FOG_RGB[2] - c[2]) * t)
  return `rgb(${r},${g},${b})`
}

const GRASS_A = hex('#3FA33A')
const GRASS_B = hex('#369133')
const ROAD_A = hex('#575263')
const ROAD_B = hex('#524D5E')
const RUMBLE_A = hex('#E8455A')
const RUMBLE_B = hex('#F4EFFF')

/** árvores/placas procedurais: determinístico a partir da distância */
function seededSide(k: number): number {
  return (k * 2654435761) % 2 === 0 ? -1 : 1
}

export class RacingClientView implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private prev: Stamped | null = null
  private next: Stamped | null = null
  private myCar: CarState | null = null
  private seq = 0
  private history: Array<{ seq: number; input: CarInputState; dt: number }> = []
  private sendTimer = 0
  private time = 0
  private lastLap = 0
  private bgOff = 0
  private steerLean = 0
  private layout = trackLayout(50)
  /** toque: estado dos botões virtuais */
  touch = { left: false, right: false, drift: false, boost: false }

  constructor(
    public yourSeat: number,
    private send: (input: CarInputState) => void,
    private onHud: (hud: RaceHud) => void,
  ) {}

  private vehicle(): VehicleKind {
    return this.next?.snap.vehicle ?? 'carro'
  }

  private currentInput(): Omit<CarInputState, 'seq'> {
    const axis = this.input.axis()
    let steer = axis.x
    if (this.touch.left) steer -= 1
    if (this.touch.right) steer += 1
    return {
      steer: clamp(steer, -1, 1),
      brake: axis.y > 0,
      drift: this.input.pressed('shift') || this.touch.drift,
      boost: this.input.pressed(' ') || this.input.pressed('x') || this.touch.boost,
    }
  }

  pushSnapshot(snap: RacingSnapshot) {
    this.prev = this.next
    this.next = { snap, at: performance.now() }

    // RECONCILIAÇÃO: estado oficial + inputs ainda não processados
    if (this.yourSeat >= 0) {
      const server = snap.cars[this.yourSeat]
      if (server) {
        const ack = snap.lastAck[this.yourSeat] ?? 0
        this.history = this.history.filter((h) => h.seq > ack)
        let car = { ...server }
        for (const h of this.history) car = stepCar(car, h.input, h.dt, snap.vehicle)
        this.myCar = car
      }
    }

    const mine = this.myCar ?? snap.cars[Math.max(this.yourSeat, 0)]
    if (mine && mine.lap !== this.lastLap && mine.lap > 0 && mine.lap < snap.totalLaps) {
      this.lastLap = mine.lap
      this.texts.add(RACE_W / 2, RACE_H * 0.42, `volta ${mine.lap + 1}/${snap.totalLaps}!`, '#FFC53D', 26)
    }
    this.pushHud()
  }

  private pushHud() {
    const snap = this.next?.snap
    if (!snap) return
    const mine = this.myCar ?? snap.cars[Math.max(this.yourSeat, 0)]
    const progressList = snap.cars
      .map((c, seat) => ({
        seat,
        p: c.finished ? 1e9 - (c.finishTime ?? 0) : raceProgress(seat === this.yourSeat && this.myCar ? this.myCar : c),
      }))
      .sort((a, b) => b.p - a.p)
    const position = progressList.findIndex((r) => r.seat === this.yourSeat) + 1
    this.onHud({
      lap: Math.min((mine?.lap ?? 0) + 1, snap.totalLaps),
      totalLaps: snap.totalLaps,
      boost: mine?.boostMeter ?? 0,
      speed: Math.round((mine?.speed ?? 0) * 0.72),
      position: position || 1,
      players: snap.cars.length,
      phase: snap.phase,
      countdown: snap.countdown,
      finishOrder: snap.finishOrder,
      yourSeat: this.yourSeat,
      vehicle: snap.vehicle,
    })
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)

    const snap = this.next?.snap
    if (!snap || this.yourSeat < 0) return

    if (snap.phase === 'racing' && this.myCar && !this.myCar.finished) {
      // PREDIÇÃO: aplica o input local imediatamente
      this.seq++
      const raw = this.currentInput()
      const inp: CarInputState = { seq: this.seq, ...raw }
      this.history.push({ seq: this.seq, input: inp, dt })
      if (this.history.length > 240) this.history.shift()
      const before = this.myCar
      this.myCar = stepCar(this.myCar, inp, dt, snap.vehicle)
      this.steerLean += (raw.steer - this.steerLean) * Math.min(dt * 9, 1)

      // fundo desliza na direção contrária da curva (rumo em rad/s × fator)
      this.bgOff -= (curveAt(this.myCar.dist) / CURVE_K) * this.myCar.speed * dt * 130

      // fumaça do drift + chama do boost (efeitos locais)
      if (this.myCar.drifting && Math.abs(this.myCar.latV) > 0.8 && Math.random() < 0.8) {
        this.particles.list.push({
          x: RACE_W / 2 + rand(-26, 26),
          y: RACE_H - 44 + rand(-2, 6),
          vx: rand(-40, 40) - this.myCar.latV * 30,
          vy: rand(-10, -50),
          life: rand(0.3, 0.6),
          maxLife: 0.6,
          color: 'rgba(235,230,240,0.8)',
          size: rand(4, 9),
        })
      }
      if (this.myCar.boosting && Math.random() < 0.8) {
        this.particles.list.push({
          x: RACE_W / 2 + rand(-14, 14),
          y: RACE_H - 34,
          vx: rand(-20, 20),
          vy: rand(30, 90),
          life: rand(0.12, 0.3),
          maxLife: 0.3,
          color: Math.random() < 0.5 ? '#FFC53D' : '#FF8244',
          size: rand(3, 6),
        })
      }
      if (this.myCar.lap !== before.lap) this.pushHud()

      // envia o estado de input ao servidor (~20Hz)
      this.sendTimer -= dt
      if (this.sendTimer <= 0) {
        this.send(inp)
        this.sendTimer = 0.05
      }
    }
  }

  /* ---------------- desenho ---------------- */

  private lerpFactor(): number {
    if (!this.prev || !this.next) return 1
    const span = this.next.at - this.prev.at || 100
    return clamp((performance.now() - this.next.at) / span + 1, 0, 1.3)
  }

  /** carro de referência da câmera (o meu, ou o líder para espectador) */
  private cameraCar(): CarState | null {
    if (this.myCar) return this.myCar
    const snap = this.next?.snap
    if (!snap) return null
    if (this.yourSeat >= 0) return snap.cars[this.yourSeat] ?? null
    return [...snap.cars].sort((a, b) => raceProgress(b) - raceProgress(a))[0] ?? null
  }

  draw(ctx: CanvasRenderingContext2D) {
    const cam = this.cameraCar()
    const snap = this.next?.snap
    if (!cam || !snap) {
      ctx.fillStyle = '#1B1235'
      ctx.fillRect(0, 0, RACE_W, RACE_H)
      return
    }

    const camDist = cam.dist - CAM_BACK
    const camLat = cam.lat
    const camElev = elevationAt(camDist) * HILL_SCALE

    this.drawSky(ctx)

    // ---- projeção das fatias (perto → longe, com oclusão de crista) ----
    const proj: SliceProj[] = []
    let xoff = 0
    let dxoff = 0
    let clipY = RACE_H + 40
    for (let n = 0; n < SLICES; n++) {
      const d = camDist + n * SLICE
      const z = (n + 1) * SLICE
      const e = elevationAt(d) * HILL_SCALE - camElev
      const y = CY + ((CAM_H - e) * FOCAL) / z
      const half = (ROAD_W * FOCAL) / z
      const x = RACE_W / 2 + xoff - camLat * half
      const hidden = y >= clipY
      if (!hidden) clipY = y
      proj.push({ y, x, half, d, z, hidden })
      // acumula a curva em px (efeito parabólico clássico do pseudo-3D)
      dxoff += (curveAt(d) / CURVE_K) * CURVE_PX * SLICE
      xoff += dxoff
    }

    // ---- pinta as faixas (longe → perto para o painter's algorithm) ----
    for (let n = SLICES - 2; n >= 0; n--) {
      const a = proj[n]! // perto (embaixo)
      const b = proj[n + 1]! // longe (em cima)
      if (a.hidden && b.hidden) continue
      const top = Math.min(b.y, a.y)
      const bottom = Math.max(a.y, top + 0.5)
      const fog = Math.min((n / SLICES) ** 1.6 * 0.82, 0.82)
      const par = Math.floor(a.d / 55) % 2 === 0

      // grama
      ctx.fillStyle = fogMix(par ? GRASS_A : GRASS_B, fog)
      ctx.fillRect(0, top, RACE_W, bottom - top)

      // zebra + asfalto como trapézios
      const quad = (x1: number, w1: number, x2: number, w2: number, color: string) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(x1 - w1, a.y)
        ctx.lineTo(x1 + w1, a.y)
        ctx.lineTo(x2 + w2, b.y)
        ctx.lineTo(x2 - w2, b.y)
        ctx.closePath()
        ctx.fill()
      }
      quad(a.x, a.half * 1.16, b.x, b.half * 1.16, fogMix(par ? RUMBLE_A : RUMBLE_B, fog))
      quad(a.x, a.half, b.x, b.half, fogMix(par ? ROAD_A : ROAD_B, fog))
      // linhas laterais
      quad(a.x - a.half * 0.9, a.half * 0.025, b.x - b.half * 0.9, b.half * 0.025, fogMix(RUMBLE_B, fog))
      quad(a.x + a.half * 0.9, a.half * 0.025, b.x + b.half * 0.9, b.half * 0.025, fogMix(RUMBLE_B, fog))
      // faixa central tracejada
      if (Math.floor(a.d / 30) % 2 === 0) {
        quad(a.x, a.half * 0.022, b.x, b.half * 0.022, fogMix(RUMBLE_B, fog * 0.9))
      }
      // linha de chegada (xadrez) perto do fim da volta
      const lapD = lapDistance(a.d)
      if (lapD < 26) {
        for (let k = 0; k < 8; k++) {
          const t1 = k / 8
          const t2 = (k + 1) / 8
          const white = (k + (lapD < 13 ? 0 : 1)) % 2 === 0
          quad(
            a.x - a.half + a.half * (t1 + t2),
            a.half * (t2 - t1),
            b.x - b.half + b.half * (t1 + t2),
            b.half * (t2 - t1),
            white ? '#F4EFFF' : '#140E26',
          )
        }
      }
    }

    // ---- sprites (árvores, placas, pórtico, rivais) longe → perto ----
    const sprites: Sprite[] = []
    for (let n = 2; n < SLICES; n++) {
      const p = proj[n]!
      if (p.hidden) continue
      const lapD = Math.floor(lapDistance(p.d) / SLICE) * SLICE

      // árvores a cada ~112 unidades, lados alternados
      if (lapD % 112 < SLICE) {
        const k = Math.floor(lapD / 112)
        const side = seededSide(k)
        const off = 1.7 + ((k * 37) % 60) / 55
        sprites.push({ n, draw: (c) => this.drawTree(c, p.x + side * off * p.half, p.y, p.half, k) })
      }
      // placas de seta na entrada das curvas fortes
      const seg = TRACK_SEGMENTS.find((s) => lapDistance(p.d) >= s.start && lapDistance(p.d) < s.start + s.length)
      if (seg && Math.abs(seg.curve / CURVE_SCALE) > 1.2) {
        const local = lapDistance(p.d) - seg.start
        if (local > 20 && local < 220 && Math.floor(local / 65) * 65 <= local && local % 65 < SLICE) {
          const dir = Math.sign(seg.curve)
          sprites.push({ n, draw: (c) => this.drawArrowSign(c, p.x - dir * 1.5 * p.half, p.y, p.half, dir) })
        }
      }
      // pórtico de largada
      if (lapD < SLICE) {
        sprites.push({ n, draw: (c) => this.drawGantry(c, p.x, p.y, p.half) })
      }
    }

    // rivais projetados na pista
    const f = this.lerpFactor()
    snap.cars.forEach((serverCar, seat) => {
      if (seat === this.yourSeat) return
      let car = serverCar
      const p0 = this.prev?.snap.cars[seat]
      if (p0) {
        car = {
          ...serverCar,
          dist: p0.dist + (serverCar.dist - p0.dist) * f,
          lat: p0.lat + (serverCar.lat - p0.lat) * f,
        }
      }
      const rel = car.dist - camDist
      // só desenha quem está DE FATO à frente do meu veículo (o resto, minimapa)
      if (rel < CAM_BACK * 1.2 || rel > (SLICES - 2) * SLICE) return
      const n = Math.max(Math.floor(rel / SLICE) - 1, 0)
      const p = proj[n]!
      if (p.hidden) return
      const x = p.x + car.lat * p.half
      // veículo ocupa ~34 unidades do mundo; sprite nativo tem ~96px → 0.354
      // (teto de escala: rival lado a lado não vira um gigante sobre o seu)
      const scale = Math.min((p.half / ROAD_W) * 0.354, 1.15)
      sprites.push({
        n,
        draw: (c) => this.drawVehicleSprite(c, x, p.y, scale, seat, car, snap.vehicle, false),
      })
    })

    sprites.sort((a, b) => b.n - a.n)
    for (const s of sprites) s.draw(ctx)

    // ---- meu veículo (fixo embaixo; a pista se move sob ele) ----
    if (this.yourSeat >= 0) {
      const me = this.myCar ?? snap.cars[this.yourSeat]
      if (me) this.drawVehicleSprite(ctx, RACE_W / 2, RACE_H - 26, 1, this.yourSeat, me, snap.vehicle, true)
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    this.drawMinimap(ctx, snap, cam)

    // vinheta suave
    const vg = ctx.createRadialGradient(RACE_W / 2, RACE_H / 2, RACE_H * 0.45, RACE_W / 2, RACE_H / 2, RACE_H * 0.95)
    vg.addColorStop(0, 'rgba(20,14,38,0)')
    vg.addColorStop(1, 'rgba(20,14,38,0.4)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, RACE_W, RACE_H)
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const sky = ctx.createLinearGradient(0, 0, 0, CY + 30)
    sky.addColorStop(0, '#241553')
    sky.addColorStop(0.55, '#6B44C8')
    sky.addColorStop(1, '#C878E8')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, RACE_W, CY + 30)

    // sol pop
    const sunX = ((this.bgOff * 0.25 + RACE_W * 0.72) % (RACE_W * 1.6) + RACE_W * 1.6) % (RACE_W * 1.6) - RACE_W * 0.3
    withGlow(ctx, '#FFC53D', 26, () => {
      ctx.fillStyle = '#FFD873'
      ctx.beginPath()
      ctx.arc(sunX, CY - 52, 30, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(200,120,232,0.55)'
    ctx.fillRect(sunX - 34, CY - 46, 68, 3)
    ctx.fillRect(sunX - 30, CY - 38, 60, 3)

    // montanhas em 2 camadas (parallax com a curva)
    for (const [k, color, amp] of [
      [0.4, '#3A2472', 34],
      [0.7, '#4C2F96', 22],
    ] as const) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, CY + 30)
      for (let x = 0; x <= RACE_W; x += 16) {
        const t = (x + this.bgOff * k) * 0.012
        const y = CY + 6 - Math.abs(Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.4) * amp
        ctx.lineTo(x, y)
      }
      ctx.lineTo(RACE_W, CY + 30)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, k: number) {
    const s = half / 457 // 0..1
    const h = 220 * s
    if (h < 3) return
    ctx.fillStyle = '#4A2E1E'
    ctx.fillRect(x - 4 * s, y - h * 0.4, 8 * s, h * 0.4)
    const green = k % 3 === 0 ? '#2E8B4A' : '#37A155'
    ctx.fillStyle = green
    ctx.beginPath()
    ctx.arc(x, y - h * 0.62, h * 0.34, 0, Math.PI * 2)
    ctx.arc(x - h * 0.2, y - h * 0.42, h * 0.26, 0, Math.PI * 2)
    ctx.arc(x + h * 0.2, y - h * 0.42, h * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.beginPath()
    ctx.arc(x - h * 0.1, y - h * 0.7, h * 0.14, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawArrowSign(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, dir: number) {
    const s = half / 457
    const w = 90 * s
    const h = 34 * s
    if (h < 2.5) return
    ctx.fillStyle = '#B8B2C8'
    ctx.fillRect(x - 3 * s, y - 44 * s, 6 * s, 44 * s)
    ctx.fillStyle = '#E8455A'
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - 44 * s - h, w, h, 4 * s)
    ctx.fill()
    ctx.strokeStyle = '#FFF9F0'
    ctx.lineWidth = Math.max(3.5 * s, 1)
    ctx.lineJoin = 'round'
    for (let i = -1; i <= 1; i++) {
      const cxp = x + i * w * 0.28
      ctx.beginPath()
      ctx.moveTo(cxp - dir * w * 0.08, y - 44 * s - h * 0.74)
      ctx.lineTo(cxp + dir * w * 0.08, y - 44 * s - h * 0.5)
      ctx.lineTo(cxp - dir * w * 0.08, y - 44 * s - h * 0.26)
      ctx.stroke()
    }
  }

  private drawGantry(ctx: CanvasRenderingContext2D, x: number, y: number, half: number) {
    const s = half / 457
    if (s < 0.02) return
    const w = half * 2.6
    const ph = 120 * s
    ctx.fillStyle = '#39324A'
    ctx.fillRect(x - w / 2 - 8 * s, y - ph, 16 * s, ph)
    ctx.fillRect(x + w / 2 - 8 * s, y - ph, 16 * s, ph)
    const bh = 42 * s
    const grad = ctx.createLinearGradient(0, y - ph - bh, 0, y - ph)
    grad.addColorStop(0, '#9D5CFF')
    grad.addColorStop(1, '#F252C1')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x - w / 2 - 14 * s, y - ph - bh, w + 28 * s, bh, 8 * s)
    ctx.fill()
    if (s > 0.1) {
      ctx.fillStyle = '#FFF9F0'
      ctx.font = `800 ${Math.max(bh * 0.55, 8)}px "Baloo 2 Variable", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('MESA POP', x, y - ph - bh / 2)
      ctx.textBaseline = 'alphabetic'
    }
  }

  /**
   * Sprite de veículo visto de trás. `big` = o veículo do jogador
   * (embaixo, com inclinação de volante/drift e luz de freio).
   */
  private drawVehicleSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    seat: number,
    car: CarState,
    vehicle: VehicleKind,
    big: boolean,
  ) {
    if (scale < 0.035) return
    const color = CAR_COLORS[seat % CAR_COLORS.length]!
    const lean = big ? this.steerLean * 0.14 + (car.drifting ? clamp(car.latV * 0.07, -0.3, 0.3) : 0) : 0

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.rotate(lean)

    // sombra
    ctx.fillStyle = 'rgba(10,16,8,0.4)'
    ctx.beginPath()
    ctx.ellipse(0, 4, vehicle === 'moto' ? 30 : 58, 12, 0, 0, Math.PI * 2)
    ctx.fill()

    // chama do boost
    if (car.boosting) {
      withGlow(ctx, '#FFC53D', 18, () => {
        const flick = Math.sin(this.time * 42 + seat) * 8
        const flame = ctx.createLinearGradient(0, 0, 0, 46 + flick)
        flame.addColorStop(0, '#FFF9F0')
        flame.addColorStop(0.4, '#FFC53D')
        flame.addColorStop(1, 'rgba(255,130,68,0)')
        ctx.fillStyle = flame
        for (const ex of vehicle === 'moto' ? [0] : [-26, 26]) {
          ctx.beginPath()
          ctx.moveTo(ex - 9, -6)
          ctx.lineTo(ex, 40 + flick)
          ctx.lineTo(ex + 9, -6)
          ctx.closePath()
          ctx.fill()
        }
      })
    }

    if (vehicle === 'moto') {
      // pneu traseiro
      ctx.fillStyle = '#161221'
      ctx.beginPath()
      ctx.roundRect(-13, -18, 26, 24, 9)
      ctx.fill()
      // rabeta
      const body = ctx.createLinearGradient(-18, 0, 18, 0)
      body.addColorStop(0, color.dark)
      body.addColorStop(0.5, color.body)
      body.addColorStop(1, color.dark)
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.roundRect(-20, -34, 40, 22, 10)
      ctx.fill()
      // piloto (capacete + costas) inclinando
      ctx.save()
      ctx.rotate(lean * 1.6)
      ctx.fillStyle = '#2A2140'
      ctx.beginPath()
      ctx.roundRect(-16, -62, 32, 34, 14)
      ctx.fill()
      ctx.fillStyle = color.body
      ctx.beginPath()
      ctx.arc(0, -66, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(-4, -70, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // luz de freio
      if (big && this.input.axis().y > 0) {
        withGlow(ctx, '#FF4D4D', 12, () => {
          ctx.fillStyle = '#FF6B6B'
          ctx.fillRect(-8, -24, 16, 5)
        })
      }
    } else {
      // rodas traseiras
      ctx.fillStyle = '#161221'
      ctx.beginPath()
      ctx.roundRect(-56, -16, 18, 26, 6)
      ctx.roundRect(38, -16, 18, 26, 6)
      ctx.fill()
      // carroceria
      const body = ctx.createLinearGradient(-50, 0, 50, 0)
      body.addColorStop(0, color.dark)
      body.addColorStop(0.5, color.body)
      body.addColorStop(1, color.dark)
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.roundRect(-48, -30, 96, 34, 12)
      ctx.fill()
      // teto + vidro traseiro
      ctx.fillStyle = color.dark
      ctx.beginPath()
      ctx.roundRect(-32, -52, 64, 26, 10)
      ctx.fill()
      ctx.fillStyle = 'rgba(24,18,42,0.85)'
      ctx.beginPath()
      ctx.roundRect(-26, -48, 52, 16, 7)
      ctx.fill()
      // aerofólio
      ctx.fillStyle = '#241C3A'
      ctx.fillRect(-44, -40, 8, 12)
      ctx.fillRect(36, -40, 8, 12)
      ctx.beginPath()
      ctx.roundRect(-50, -44, 100, 8, 4)
      ctx.fill()
      // lanternas
      const braking = big && this.input.axis().y > 0
      withGlow(ctx, braking ? '#FF4D4D' : 'transparent', braking ? 14 : 0, () => {
        ctx.fillStyle = braking ? '#FF6B6B' : '#B33'
        ctx.beginPath()
        ctx.roundRect(-42, -22, 16, 7, 3)
        ctx.roundRect(26, -22, 16, 7, 3)
        ctx.fill()
      })
      // brilho do teto
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.roundRect(-28, -51, 56, 5, 3)
      ctx.fill()
    }

    ctx.restore()

    if (car.finished) {
      ctx.save()
      ctx.font = `800 ${Math.max(20 * scale, 10)}px "Baloo 2 Variable", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('🏁', x, y - 70 * scale)
      ctx.restore()
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, snap: RacingSnapshot, cam: CarState) {
    const pts = this.layout
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [px, py] of pts) {
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
    const bw = 132
    const bh = 96
    const pad = 10
    const sx = (bw - pad * 2) / (maxX - minX || 1)
    const sy = (bh - pad * 2) / (maxY - minY || 1)
    const s = Math.min(sx, sy)
    const ox = RACE_W - bw - 12
    const oy = 12
    const map = (px: number, py: number): [number, number] => [
      ox + pad + (px - minX) * s + ((bw - pad * 2 - (maxX - minX) * s) / 2),
      oy + pad + (py - minY) * s + ((bh - pad * 2 - (maxY - minY) * s) / 2),
    ]

    ctx.save()
    ctx.fillStyle = 'rgba(20,14,38,0.6)'
    ctx.beginPath()
    ctx.roundRect(ox, oy, bw, bh, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(244,239,255,0.55)'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach(([px, py], i) => {
      const [mx, my] = map(px, py)
      if (i === 0) ctx.moveTo(mx, my)
      else ctx.lineTo(mx, my)
    })
    ctx.closePath()
    ctx.stroke()
    // largada
    const [gx, gy] = map(pts[0]![0], pts[0]![1])
    ctx.fillStyle = '#FFF9F0'
    ctx.fillRect(gx - 3, gy - 3, 6, 6)

    const step = TRACK_LENGTH / pts.length
    const dot = (car: CarState, seat: number, me: boolean) => {
      const idx = Math.min(Math.floor(lapDistance(car.dist) / step), pts.length - 1)
      const [mx, my] = map(pts[idx]![0], pts[idx]![1])
      ctx.fillStyle = CAR_COLORS[seat % CAR_COLORS.length]!.body
      ctx.beginPath()
      ctx.arc(mx, my, me ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fill()
      if (me) {
        ctx.strokeStyle = '#FFF9F0'
        ctx.lineWidth = 1.6
        ctx.stroke()
      }
    }
    snap.cars.forEach((c, seat) => {
      if (seat !== this.yourSeat) dot(c, seat, false)
    })
    if (this.yourSeat >= 0) dot(this.myCar ?? cam, this.yourSeat, true)
    ctx.restore()
  }
}
