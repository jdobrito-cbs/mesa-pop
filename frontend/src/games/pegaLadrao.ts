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

/** loja GIGANTE estilo Keystone Kapers: ~7,5 telas de rolagem lateral */
const WORLD_W = 4200
const FLOORS = 4
const FLOOR_H = 104
const RADAR_H = 52
const FLOOR_Y = (f: number) => PEGA_H - RADAR_H - 46 - f * FLOOR_H // y do CHÃO do andar
const ESCALATOR_W = 90
const ELEV_X = WORLD_W / 2 // elevador central, como no clássico

type HazardKind = 'carrinho' | 'bola' | 'aviao' | 'radinho'

interface Hazard {
  kind: HazardKind
  floor: number
  x: number
  vx: number
  phase: number
}

/** cada FASE libera obstáculos novos */
function hazardsForRound(round: number): HazardKind[] {
  if (round <= 1) return ['carrinho', 'bola']
  if (round === 2) return ['carrinho', 'bola', 'aviao']
  return ['carrinho', 'bola', 'aviao', 'radinho']
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
  private inElevator = false

  // elevador central: sobe e desce sozinho, parando em cada andar
  private elevFloor = 0
  private elevDir = 1
  private elevPause = 1.2

  // ladrão
  private tx = 700
  private tFloor = 1
  private tOnEscalator: { progress: number } | null = null
  private escaped = false

  private hazards: Hazard[] = []
  private spawnTimer = 1.4

  private timeLeft = 300 // mesmo relógio do resetRound
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
      weapon: `⏱ ${Math.max(Math.ceil(this.timeLeft), 0)}s · fase ${this.round}`,
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

  /** sentido da CORRIDA no andar (para onde fica a escada rolante) */
  private dirCaminho(f: number): number {
    return f % 2 === 0 ? 1 : -1
  }

  /** inclinação da rampa da escada (para onde ela sobe na horizontal) */
  private dirRampa(f: number): number {
    return f % 2 === 0 ? -1 : 1
  }

  private resetRound(nextRound: boolean) {
    if (nextRound) this.round++
    this.x = 120
    this.floor = 0
    this.jumpY = 0
    this.vy = 0
    this.onEscalator = null
    this.inElevator = false
    this.elevFloor = 0
    this.elevDir = 1
    this.elevPause = 1.2
    this.tx = 950 + rand(0, 400)
    this.tFloor = 1
    this.tOnEscalator = null
    this.escaped = false
    this.hazards = []
    this.timeLeft = 300 // relógio folgado (pedido do usuário)
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

    // elevador central anda sozinho, parando em cada andar
    if (this.elevPause > 0) {
      this.elevPause -= dt
    } else {
      this.elevFloor += this.elevDir * dt / 1.3
      if (this.elevFloor >= FLOORS - 1 || this.elevFloor <= 0) {
        this.elevFloor = clamp(this.elevFloor, 0, FLOORS - 1)
        this.elevDir *= -1
        this.elevPause = 1.1
      } else if (Math.abs(this.elevFloor - Math.round(this.elevFloor)) < dt / 1.3) {
        this.elevFloor = Math.round(this.elevFloor)
        this.elevPause = 1.1
      }
    }
    const elevParked = this.elevPause > 0
    const elevAtFloor = Math.round(this.elevFloor)

    if (this.inElevator) {
      // dentro da cabine: acompanha; sai andando quando ela para
      this.floor = elevAtFloor
      this.x = ELEV_X
      if (elevParked && Math.abs(move) > 0.3) {
        this.inElevator = false
        this.x = ELEV_X + Math.sign(move) * 34
      }
    } else if (this.onEscalator) {
      // ACOMPANHA a escada rolante: sobe degrau a degrau pela RAMPA
      // (x desliza junto — nada de teleporte de andar)
      this.onEscalator.progress = Math.min(this.onEscalator.progress + dt * 0.95, 1)
      this.x = this.escalatorX(this.floor) + this.dirRampa(this.floor) * ESCALATOR_W * this.onEscalator.progress
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
      // entra no elevador se a cabine estiver parada neste andar
      if (
        elevParked &&
        elevAtFloor === this.floor &&
        Math.abs(this.x - ELEV_X) < 14 &&
        this.jumpY === 0
      ) {
        this.inElevator = true
        this.x = ELEV_X
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
        // o ladrão também ACOMPANHA a rampa
        this.tOnEscalator.progress = Math.min(this.tOnEscalator.progress + dt * 0.95, 1)
        this.tx = this.escalatorX(this.tFloor) + this.dirRampa(this.tFloor) * ESCALATOR_W * this.tOnEscalator.progress
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
        const tSpeed = 112 + this.round * 10
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

    // ---- obstáculos: SEMPRE vêm de frente, contra o sentido da corrida
    // (o herói corre para a escada rolante do andar; os objetos descem
    // da direção da escada para cima dele — estilo Keystone Kapers) ----
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      const pool = hazardsForRound(this.round)
      const kind = pool[Math.floor(rand(0, pool.length))]!
      // metade no seu andar (pressão!), metade nos vizinhos — mas NUNCA
      // mais de UM objeto por andar (um de cada vez para cima do herói)
      const candidato =
        rand(0, 1) < 0.5 ? this.floor : clamp(this.floor + (rand(0, 1) < 0.5 ? 1 : -1), 0, FLOORS - 1)
      const livre = this.hazards.every((h) => h.floor !== candidato)
      if (livre) {
        const sentido = this.dirCaminho(candidato) // para onde se corre nesse andar
        const base =
          kind === 'radinho' ? 290 : kind === 'aviao' ? 240 : kind === 'carrinho' ? 170 : 130
        const nasceX = clamp(this.x + sentido * (PEGA_W * 0.62 + rand(0, 120)), 40, WORLD_W - 40)
        this.hazards.push({
          kind,
          floor: candidato,
          x: nasceX,
          vx: -sentido * base * (1 + this.round * 0.06),
          phase: rand(0, Math.PI * 2),
        })
      }
      this.spawnTimer = Math.max(1.6 - this.round * 0.12, 0.55)
    }
    for (const h of this.hazards) {
      h.x += h.vx * dt
      h.phase += dt * 6
    }
    this.hazards = this.hazards.filter((h) => h.x > -60 && h.x < WORLD_W + 60)

    // colisão com o guarda
    if (this.stunned <= 0 && !this.onEscalator && !this.inElevator) {
      for (const h of this.hazards) {
        if (h.floor !== this.floor || Math.abs(h.x - this.x) > 20) continue
        const low =
          h.kind === 'carrinho' || h.kind === 'radinho' || (h.kind === 'bola' && Math.sin(h.phase) < 0.2)
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
      // vitrines de fundo — cada SEÇÃO da loja tem cara própria
      for (let vx = 60; vx < WORLD_W; vx += 180) {
        const sec = ((vx / 180) | 0) + f * 3
        const hue = ['#2E2058', '#31255E', '#2A1E52', '#332262'][sec % 4]!
        const accent = ['#F252C1', '#33E0D6', '#FFC53D', '#55E07F'][sec % 4]!
        ctx.fillStyle = hue
        ctx.fillRect(vx, y - 82, 120, 70)
        // TOLDO listrado da vitrine (identidade da seção)
        ctx.fillStyle = accent
        for (let tld = 0; tld < 6; tld++) {
          ctx.globalAlpha = tld % 2 === 0 ? 0.85 : 0.35
          ctx.fillRect(vx - 2 + tld * 21, y - 88, 21, 8)
        }
        ctx.globalAlpha = 1
        // vidro com brilho diagonal
        const vidro = ctx.createLinearGradient(vx, y - 76, vx + 108, y - 32)
        vidro.addColorStop(0, 'rgba(157,92,255,0.25)')
        vidro.addColorStop(0.5, 'rgba(157,92,255,0.10)')
        vidro.addColorStop(1, 'rgba(244,239,255,0.18)')
        ctx.fillStyle = vidro
        ctx.fillRect(vx + 6, y - 76, 108, 44)
        // conteúdo da vitrine varia (manequim / TVs / araras / plantas)
        ctx.fillStyle = `${accent}55`
        if (sec % 4 === 0) {
          ctx.beginPath()
          ctx.arc(vx + 34, y - 56, 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(vx + 26, y - 50, 16, 18)
        } else if (sec % 4 === 1) {
          ctx.fillRect(vx + 16, y - 60, 26, 16)
          ctx.fillRect(vx + 50, y - 60, 26, 16)
        } else if (sec % 4 === 2) {
          ctx.fillRect(vx + 14, y - 66, 3, 30)
          for (let r = 0; r < 4; r++) ctx.fillRect(vx + 20 + r * 12, y - 62, 8, 22)
        } else {
          ctx.beginPath()
          ctx.arc(vx + 30, y - 60, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(vx + 27, y - 52, 6, 16)
        }
        ctx.fillStyle = 'rgba(244,239,255,0.18)'
        ctx.fillRect(vx + 76, y - 46, 34, 22)
      }
      // pilares estruturais (referência forte de rolagem)
      for (let px = 300; px < WORLD_W; px += 500) {
        const pg = ctx.createLinearGradient(px, 0, px + 18, 0)
        pg.addColorStop(0, '#453077')
        pg.addColorStop(0.5, '#5A3DA8')
        pg.addColorStop(1, '#392764')
        ctx.fillStyle = pg
        ctx.fillRect(px, y - FLOOR_H + 12, 18, FLOOR_H - 12)
      }
      // placas de seção penduradas
      for (let sx = 250; sx < WORLD_W; sx += 620) {
        const label = ['BRINQUEDOS', 'ESPORTES', 'MODA', 'ELETRO'][(((sx / 620) | 0) + f) % 4]!
        ctx.fillStyle = '#171029'
        ctx.beginPath()
        ctx.roundRect(sx, y - FLOOR_H + 16, 92, 20, 5)
        ctx.fill()
        ctx.font = '800 10px "Baloo 2 Variable", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#FFC53D'
        ctx.fillText(label, sx + 46, y - FLOOR_H + 30)
      }
      // piso XADREZ de loja de departamento
      const g = ctx.createLinearGradient(0, y, 0, y + 14)
      g.addColorStop(0, '#5A3DA8')
      g.addColorStop(1, '#3A2472')
      ctx.fillStyle = g
      ctx.fillRect(0, y, WORLD_W, 14)
      ctx.fillStyle = 'rgba(244,239,255,0.10)'
      for (let tx2 = 0; tx2 < WORLD_W; tx2 += 56) ctx.fillRect(tx2, y, 28, 7)
      ctx.fillStyle = 'rgba(20,14,38,0.25)'
      for (let tx2 = 28; tx2 < WORLD_W; tx2 += 56) ctx.fillRect(tx2, y + 7, 28, 7)
      // luminárias do teto do andar
      for (let lx = 220; lx < WORLD_W; lx += 440) {
        ctx.strokeStyle = 'rgba(255,249,240,0.22)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(lx, y - FLOOR_H + 12)
        ctx.lineTo(lx, y - FLOOR_H + 24)
        ctx.stroke()
        withGlow(ctx, '#FFC53D', 9, () => {
          ctx.fillStyle = '#FFD873'
          ctx.beginPath()
          ctx.ellipse(lx, y - FLOOR_H + 27, 9, 4, 0, 0, Math.PI * 2)
          ctx.fill()
        })
      }
      // escada rolante com CORPO: base, degraus animados e corrimão neon
      if (f < FLOORS - 1) {
        const ex = this.escalatorX(f)
        const topY = FLOOR_Y(f + 1)
        const dir = f % 2 === 0 ? -1 : 1
        // base metálica
        ctx.strokeStyle = '#1E4B47'
        ctx.lineWidth = 12
        ctx.beginPath()
        ctx.moveTo(ex, y)
        ctx.lineTo(ex + dir * ESCALATOR_W, topY + 14)
        ctx.stroke()
        // esteira
        ctx.strokeStyle = '#33E0D6'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(ex, y)
        ctx.lineTo(ex + dir * ESCALATOR_W, topY + 14)
        ctx.stroke()
        // degraus subindo (animados)
        ctx.strokeStyle = 'rgba(51,224,214,0.5)'
        ctx.lineWidth = 3
        for (let s = 0; s < 6; s++) {
          const t = ((s / 6 + this.time * 0.25) % 1 + 1) % 1
          const sx = ex + dir * ESCALATOR_W * t
          const sy = y + (topY + 14 - y) * t
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + dir * 14, sy)
          ctx.stroke()
        }
        // corrimão com glow
        withGlow(ctx, '#33E0D6', 6, () => {
          ctx.strokeStyle = 'rgba(51,224,214,0.7)'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(ex, y - 26)
          ctx.lineTo(ex + dir * ESCALATOR_W, topY - 12)
          ctx.stroke()
        })
      }
    }
    // telhado (fuga do ladrão)
    ctx.fillStyle = '#171029'
    ctx.fillRect(0, FLOOR_Y(FLOORS - 1) - 96, WORLD_W, 8)

    // ELEVADOR central: poço + cabine que sobe e desce sozinha
    {
      const topY = FLOOR_Y(FLOORS - 1) - 88
      const botY = FLOOR_Y(0) + 12
      ctx.fillStyle = 'rgba(18,12,36,0.55)'
      ctx.fillRect(ELEV_X - 30, topY, 60, botY - topY)
      ctx.strokeStyle = '#5A3DA8'
      ctx.lineWidth = 3
      ctx.strokeRect(ELEV_X - 30, topY, 60, botY - topY)
      // cabo
      const f = Math.floor(this.elevFloor)
      const cabY =
        FLOOR_Y(f) + (FLOOR_Y(Math.min(f + 1, FLOORS - 1)) - FLOOR_Y(f)) * (this.elevFloor - f)
      ctx.strokeStyle = 'rgba(180,168,216,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ELEV_X, topY)
      ctx.lineTo(ELEV_X, cabY - 66)
      ctx.stroke()
      // cabine
      const parked = this.elevPause > 0
      withGlow(ctx, parked ? '#FFC53D' : '#9D5CFF', parked ? 10 : 5, () => {
        ctx.fillStyle = '#3A2A6B'
        ctx.fillRect(ELEV_X - 26, cabY - 66, 52, 66)
        ctx.strokeStyle = parked ? '#FFC53D' : '#9D5CFF'
        ctx.lineWidth = 2.5
        ctx.strokeRect(ELEV_X - 26, cabY - 66, 52, 66)
        ctx.fillStyle = parked ? '#FFC53D' : '#9D5CFF'
        ctx.fillRect(ELEV_X - 26, cabY - 5, 52, 5)
      })
    }

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

    // RADAR estilo Keystone Kapers: a loja inteira, com guarda e ladrão
    this.drawRadar(ctx, cam)

    this.texts.draw(ctx)
    drawVignette(ctx, PEGA_W, PEGA_H, 0.35)
  }

  private drawRadar(ctx: CanvasRenderingContext2D, cam: number) {
    const rx = 14
    const ry = PEGA_H - RADAR_H + 6
    const rw = PEGA_W - 28
    const rh = RADAR_H - 14
    ctx.fillStyle = 'rgba(18,12,36,0.92)'
    ctx.beginPath()
    ctx.roundRect(rx, ry, rw, rh, 8)
    ctx.fill()
    ctx.strokeStyle = '#5A3DA8'
    ctx.lineWidth = 2
    ctx.stroke()

    const mapX = (x: number) => rx + 8 + (x / WORLD_W) * (rw - 16)
    const mapY = (f: number, prog = 0) => ry + rh - 7 - ((f + prog) / (FLOORS - 1)) * (rh - 14)

    // linhas dos andares
    ctx.strokeStyle = 'rgba(157,92,255,0.4)'
    ctx.lineWidth = 1.5
    for (let f = 0; f < FLOORS; f++) {
      ctx.beginPath()
      ctx.moveTo(rx + 8, mapY(f))
      ctx.lineTo(rx + rw - 8, mapY(f))
      ctx.stroke()
    }
    // janela visível (o que a câmera mostra)
    ctx.strokeStyle = 'rgba(244,239,255,0.35)'
    ctx.strokeRect(mapX(cam), ry + 3, ((PEGA_W / WORLD_W) * (rw - 16)), rh - 6)

    // ladrão (pisca) e guarda
    if (!this.escaped) {
      const tGlow = Math.floor(this.time * 5) % 2 === 0
      ctx.fillStyle = tGlow ? '#F252C1' : '#B01D86'
      ctx.beginPath()
      ctx.arc(mapX(this.tx), mapY(this.tFloor, this.tOnEscalator?.progress ?? 0), 4, 0, Math.PI * 2)
      ctx.fill()
    }
    const copFloorViz = this.inElevator ? this.elevFloor : this.floor + (this.onEscalator?.progress ?? 0)
    withGlow(ctx, '#33E0D6', 6, () => {
      ctx.fillStyle = '#33E0D6'
      ctx.beginPath()
      ctx.arc(mapX(this.x), mapY(copFloorViz), 4.5, 0, Math.PI * 2)
      ctx.fill()
    })
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
    if (this.inElevator) {
      const f = Math.floor(this.elevFloor)
      const from = FLOOR_Y(f)
      const to = FLOOR_Y(Math.min(f + 1, FLOORS - 1))
      return from + (to - from) * (this.elevFloor - f)
    }
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
    } else if (h.kind === 'radinho') {
      // radinho de pilha em disparada (fase 3+)
      ctx.translate(h.x, floorY - 9)
      ctx.rotate(Math.sin(h.phase * 2) * 0.12)
      ctx.fillStyle = '#33E0D6'
      ctx.beginPath()
      ctx.roundRect(-11, -8, 22, 14, 4)
      ctx.fill()
      ctx.fillStyle = '#140E26'
      ctx.beginPath()
      ctx.arc(-4.5, -1, 3.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(3, -5, 6, 8)
      ctx.strokeStyle = '#33E0D6'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(8, -8)
      ctx.lineTo(13, -16)
      ctx.stroke()
      // nota musical saltitando
      ctx.fillStyle = '#F4EFFF'
      ctx.font = '10px sans-serif'
      ctx.fillText('♪', -2 + Math.sin(h.phase * 3) * 4, -14)
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
