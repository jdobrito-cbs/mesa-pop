/**
 * Cliente da Corrida Pop — o boss final técnico:
 * - CLIENT-SIDE PREDICTION: o próprio carro roda a MESMA física do servidor
 *   localmente, com inputs numerados (seq);
 * - RECONCILIAÇÃO: quando o snapshot chega, partimos do estado do servidor
 *   e reaplicamos os inputs que ele ainda não processou (seq > lastAck);
 * - rivais são interpolados entre snapshots.
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
import {
  isOnRoad,
  raceProgress,
  stepCar,
  CHECKPOINTS,
  RACE_H,
  RACE_W,
  ROAD_HALF_WIDTH,
  TRACK,
  type CarInputState,
  type CarState,
  type RacingSnapshot,
} from '@mesapop/shared'

const CAR_COLORS = [
  { body: '#F252C1', dark: '#B01D86', name: 'Magenta' },
  { body: '#33E0D6', dark: '#158F88', name: 'Ciano' },
  { body: '#FFC53D', dark: '#C78B0A', name: 'Amarelo' },
  { body: '#55E07F', dark: '#1F9A47', name: 'Verde' },
]

interface Stamped {
  snap: RacingSnapshot
  at: number
}

export interface RaceHud {
  lap: number
  totalLaps: number
  boost: number
  position: number
  players: number
  phase: RacingSnapshot['phase']
  countdown: number
  finishOrder: number[]
  yourSeat: number
}

interface SkidMark {
  x: number
  y: number
  angle: number
  life: number
}

export class RacingClientView implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()
  private prev: Stamped | null = null
  private next: Stamped | null = null
  private myCar: CarState | null = null
  private seq = 0
  private history: Array<{ seq: number; input: CarInputState; dt: number }> = []
  private sendTimer = 0
  private time = 0
  private skids: SkidMark[] = []
  private lastLap = 0
  /** toque: estado dos botões virtuais */
  touch = { left: false, right: false, drift: false, boost: false }

  constructor(
    public yourSeat: number,
    private send: (input: CarInputState) => void,
    private onHud: (hud: RaceHud) => void,
  ) {}

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
        for (const h of this.history) car = stepCar(car, h.input, h.dt)
        this.myCar = car
      }
    }

    const mine = this.myCar ?? snap.cars[Math.max(this.yourSeat, 0)]
    if (mine && mine.lap !== this.lastLap && mine.lap > 0 && mine.lap < snap.totalLaps) {
      this.lastLap = mine.lap
      this.texts.add(mine.x, mine.y - 24, `volta ${mine.lap + 1}/${snap.totalLaps}!`, '#FFC53D', 16)
    }
    this.pushHud()
  }

  private pushHud() {
    const snap = this.next?.snap
    if (!snap) return
    const mine = this.myCar ?? snap.cars[Math.max(this.yourSeat, 0)]
    // posição ao vivo por progresso
    const progressList = snap.cars
      .map((c, seat) => ({ seat, p: c.finished ? 1e9 - (c.finishTime ?? 0) : raceProgress(seat === this.yourSeat && this.myCar ? this.myCar : c) }))
      .sort((a, b) => b.p - a.p)
    const position = progressList.findIndex((r) => r.seat === this.yourSeat) + 1
    this.onHud({
      lap: Math.min((mine?.lap ?? 0) + 1, snap.totalLaps),
      totalLaps: snap.totalLaps,
      boost: mine?.boostMeter ?? 0,
      position: position || 1,
      players: snap.cars.length,
      phase: snap.phase,
      countdown: snap.countdown,
      finishOrder: snap.finishOrder,
      yourSeat: this.yourSeat,
    })
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    for (const s of this.skids) s.life -= dt * 0.25
    this.skids = this.skids.filter((s) => s.life > 0)

    const snap = this.next?.snap
    if (!snap || this.yourSeat < 0) return

    if (snap.phase === 'racing' && this.myCar && !this.myCar.finished) {
      // PREDIÇÃO: aplica o input local imediatamente
      this.seq++
      const inp: CarInputState = { seq: this.seq, ...this.currentInput() }
      this.history.push({ seq: this.seq, input: inp, dt })
      if (this.history.length > 240) this.history.shift()
      const before = this.myCar
      this.myCar = stepCar(this.myCar, inp, dt)

      // efeitos locais: marcas de drift + faísca do boost
      if (this.myCar.drifting) {
        const back = -12
        for (const side of [-7, 7]) {
          this.skids.push({
            x: this.myCar.x + Math.cos(this.myCar.angle) * back + Math.cos(this.myCar.angle + Math.PI / 2) * side,
            y: this.myCar.y + Math.sin(this.myCar.angle) * back + Math.sin(this.myCar.angle + Math.PI / 2) * side,
            angle: this.myCar.angle,
            life: 1,
          })
        }
      }
      if (this.myCar.boosting && Math.random() < 0.7) {
        this.particles.list.push({
          x: this.myCar.x - Math.cos(this.myCar.angle) * 16,
          y: this.myCar.y - Math.sin(this.myCar.angle) * 16,
          vx: rand(-30, 30),
          vy: rand(-30, 30),
          life: rand(0.15, 0.35),
          maxLife: 0.35,
          color: '#FFC53D',
          size: rand(2, 4),
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

  draw(ctx: CanvasRenderingContext2D) {
    // grama
    const grass = ctx.createLinearGradient(0, 0, 0, RACE_H)
    grass.addColorStop(0, '#4E9E3B')
    grass.addColorStop(1, '#3D8A2D')
    ctx.fillStyle = grass
    ctx.fillRect(0, 0, RACE_W, RACE_H)
    // textura leve
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % RACE_W
      const y = (i * 211) % RACE_H
      ctx.fillRect(x, y, 3, 3)
    }

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    // pista (borda clara + asfalto)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const path = new Path2D()
    path.moveTo(TRACK[0]![0], TRACK[0]![1])
    for (let i = 1; i <= TRACK.length; i++) {
      const [x, y] = TRACK[i % TRACK.length]!
      path.lineTo(x, y)
    }
    ctx.strokeStyle = '#E8E2D2'
    ctx.lineWidth = ROAD_HALF_WIDTH * 2 + 10
    ctx.stroke(path)
    ctx.strokeStyle = '#4A4655'
    ctx.lineWidth = ROAD_HALF_WIDTH * 2
    ctx.stroke(path)
    // faixa central tracejada
    ctx.setLineDash([16, 20])
    ctx.strokeStyle = 'rgba(255,249,240,0.5)'
    ctx.lineWidth = 3
    ctx.stroke(path)
    ctx.setLineDash([])

    // linha de largada/chegada (xadrez) no waypoint 0
    {
      const [ax, ay] = TRACK[0]!
      const [bx, by] = TRACK[1]!
      const dir = Math.atan2(by - ay, bx - ax)
      ctx.save()
      ctx.translate(ax, ay)
      ctx.rotate(dir)
      for (let row = 0; row < 2; row++) {
        for (let k = -5; k < 5; k++) {
          ctx.fillStyle = (k + row) % 2 === 0 ? '#F4EFFF' : '#140E26'
          ctx.fillRect(row * 9 - 9, k * 9, 9, 9)
        }
      }
      ctx.restore()
    }

    // marcas de drift
    for (const s of this.skids) {
      ctx.save()
      ctx.globalAlpha = s.life * 0.4
      ctx.translate(s.x, s.y)
      ctx.rotate(s.angle)
      ctx.fillStyle = '#231F2E'
      ctx.fillRect(-3, -1.4, 6, 2.8)
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // carros
    const snap = this.next?.snap
    if (snap) {
      const f = this.lerpFactor()
      snap.cars.forEach((serverCar, seat) => {
        let car = serverCar
        if (seat === this.yourSeat && this.myCar) {
          car = this.myCar // predição local
        } else if (this.prev) {
          const p = this.prev.snap.cars[seat]
          if (p) {
            let da = serverCar.angle - p.angle
            while (da > Math.PI) da -= Math.PI * 2
            while (da < -Math.PI) da += Math.PI * 2
            car = {
              ...serverCar,
              x: p.x + (serverCar.x - p.x) * f,
              y: p.y + (serverCar.y - p.y) * f,
              angle: p.angle + da * f,
            }
          }
        }
        this.drawCar(ctx, car, seat)
      })
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()
    drawVignette(ctx, RACE_W, RACE_H, 0.35)
  }

  private drawCar(ctx: CanvasRenderingContext2D, car: CarState, seat: number) {
    const color = CAR_COLORS[seat % CAR_COLORS.length]!
    ctx.save()
    ctx.translate(car.x, car.y)
    ctx.rotate(car.angle)

    // sombra
    ctx.fillStyle = 'rgba(10,20,8,0.35)'
    ctx.beginPath()
    ctx.ellipse(-1, 2.5, 15, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // chama do boost
    if (car.boosting) {
      withGlow(ctx, '#FFC53D', 12, () => {
        const flame = ctx.createLinearGradient(-16, 0, -30, 0)
        flame.addColorStop(0, '#FFF9F0')
        flame.addColorStop(0.5, '#FFC53D')
        flame.addColorStop(1, 'rgba(255,130,68,0)')
        ctx.fillStyle = flame
        ctx.beginPath()
        ctx.moveTo(-14, -4)
        ctx.lineTo(-28 - Math.sin(this.time * 40) * 4, 0)
        ctx.lineTo(-14, 4)
        ctx.closePath()
        ctx.fill()
      })
    }

    // rodas
    ctx.fillStyle = '#1B1626'
    for (const [wx, wy] of [
      [7, -8], [7, 8], [-9, -8], [-9, 8],
    ] as const) {
      ctx.beginPath()
      ctx.roundRect(wx - 3.4, wy - 2.4, 6.8, 4.8, 1.6)
      ctx.fill()
    }

    // carroceria
    const body = ctx.createLinearGradient(0, -9, 0, 9)
    body.addColorStop(0, color.body)
    body.addColorStop(1, color.dark)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.roundRect(-14, -7.5, 28, 15, 6)
    ctx.fill()
    // capô + brilho
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.roundRect(-11, -5.8, 22, 4, 3)
    ctx.fill()
    // parabrisa
    ctx.fillStyle = 'rgba(20,14,38,0.8)'
    ctx.beginPath()
    ctx.roundRect(1, -5.4, 7, 10.8, 2.5)
    ctx.fill()

    ctx.restore()

    // etiqueta de posição/estado
    if (car.finished) {
      ctx.save()
      ctx.font = '800 12px "Baloo 2 Variable", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFC53D'
      ctx.fillText('🏁', car.x, car.y - 16)
      ctx.restore()
    }
  }
}
