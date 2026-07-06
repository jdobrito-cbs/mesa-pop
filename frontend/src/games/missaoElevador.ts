/**
 * Missão Elevador — o espião desce o prédio recolhendo os DOCUMENTOS das
 * portas vermelhas até a garagem. O ELEVADOR anda SOZINHO (sobe e desce
 * parando em cada andar — entre alinhado e salte alinhado; sem softlock).
 * ←/→ anda · ↓ (ou botão) ABAIXA (esquiva dos tiros altos e atira baixo)
 * · espaço/botão = TIRO. Prédio limpo → próximo, mais alto e mais vigiado.
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
/** altura dos tiros: em pé e abaixado */
const ALTO = 26
const BAIXO = 11

interface Agent {
  x: number
  t: number // andar (0 = topo; fracionário quando está NO elevador)
  dir: number
  shootTimer: number
  alive: boolean
  /** elite (prédio 3+): terno vermelho, 2 de vida, atira BAIXO às vezes */
  elite: boolean
  hp: number
  /** patrulhando: segundos ignorando o jogador (depois de bater em algo) */
  vagar: number
  /** está DENTRO da cabine do elevador */
  noElevador: boolean
}

interface Shot {
  x: number
  y: number
  vx: number
  mine: boolean
  /** tiro rasteiro (só acerta quem NÃO abaixou/quem abaixou, respectivamente) */
  low: boolean
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
  private crouch = false
  private duckHold = 0
  private jumpY = 0
  private vy = 0
  private invuln = 0
  private fireTimer = 0
  touchShoot = false
  touchJump = false

  /** luminárias por andar — TIRO PULANDO apaga e escurece a área */
  private lampadas: Array<{ x: number; t: number; quebrada: boolean }> = []

  /** elevador AUTÔNOMO: alvo, direção e parada em cada andar */
  private elevT = 0
  private elevAlvo = 1
  private elevDir = 1
  private elevPausa = 1.4

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

  /** botão de toque: abaixa por um instante */
  triggerDuck() {
    this.duckHold = 0.9
  }

  /** botão de toque: PULA (para acertar as lâmpadas!) */
  triggerJump() {
    this.touchJump = true
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
    this.floors = Math.min(7 + this.building, 14)
    this.docsTotal = Math.min(4 + this.building, 10)
    this.docs = 0
    this.px = ELEV_W / 2
    this.pt = 0
    this.elevT = 0
    this.elevAlvo = 1
    this.elevDir = 1
    this.elevPausa = 1.6
    this.agents = []
    this.shots = []
    this.doors = []
    this.jumpY = 0
    this.vy = 0
    // luminárias acesas em todo andar (menos a garagem)
    this.lampadas = []
    for (let t = 0; t < this.floors - 1; t++) {
      for (const x of [132, ELEV_W - 132]) this.lampadas.push({ x, t, quebrada: false })
    }
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

  /** cabine alinhada num andar (parada de embarque) */
  private cabineAlinhada(): boolean {
    return this.elevPausa > 0
  }

  private aboard(): boolean {
    return Math.abs(this.px - SHAFT_X) < SHAFT_HALF - 6 && Math.abs(this.pt - this.elevT) < 0.3
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    if (this.invuln > 0) this.invuln -= dt
    if (this.fireTimer > 0) this.fireTimer -= dt
    if (this.duckHold > 0) this.duckHold -= dt

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    /* ---------- elevador autônomo: anda sozinho, para em cada andar ---------- */
    if (this.elevPausa > 0) {
      this.elevPausa -= dt
    } else {
      const delta = this.elevAlvo - this.elevT
      const passo = 1.15 * dt
      if (Math.abs(delta) <= passo) {
        this.elevT = this.elevAlvo
        this.elevPausa = 1.3 // porta aberta: dá para entrar/sair
        if (this.elevAlvo >= this.floors - 1) this.elevDir = -1
        if (this.elevAlvo <= 0) this.elevDir = 1
        this.elevAlvo = clamp(this.elevAlvo + this.elevDir, 0, this.floors - 1)
      } else {
        this.elevT += Math.sign(delta) * passo
      }
    }

    const a = this.input.axis()
    let move = a.x
    if (this.input.pointer) move = clamp((this.input.pointer.x - this.px) / 60, -1, 1)
    if (Math.abs(move) > 0.15) this.facing = Math.sign(move)

    const onElev = this.aboard()
    // abaixar funciona em QUALQUER lugar — inclusive dentro do elevador
    this.crouch = this.jumpY === 0 && (a.y > 0.3 || this.duckHold > 0)

    // PULO (↑ ou botão): fora do elevador, para alcançar as lâmpadas
    const querPular = a.y < -0.3 || this.touchJump
    this.touchJump = false
    if (querPular && !onElev && this.jumpY === 0 && !this.crouch) this.vy = 330
    if (this.vy !== 0 || this.jumpY > 0) {
      this.jumpY += this.vy * dt
      this.vy -= 980 * dt
      if (this.jumpY <= 0) {
        this.jumpY = 0
        this.vy = 0
      }
    }

    if (onElev) {
      // a bordo: acompanha a cabine; só desce dela quando ela PARA num andar
      this.pt = this.elevT
      if (this.cabineAlinhada() && Math.abs(move) > 0.15) {
        this.px = clamp(this.px + move * 190 * dt, WALL + 12, ELEV_W - WALL - 12)
      } else {
        this.px = SHAFT_X
      }
    } else {
      // anda pelo andar (o poço bloqueia se a cabine não estiver parada aqui)
      this.pt = Math.round(this.pt)
      const vel = this.crouch ? 90 : 190
      const nx = clamp(this.px + move * vel * dt, WALL + 12, ELEV_W - WALL - 12)
      const cabineAqui = this.cabineAlinhada() && Math.abs(this.elevT - this.pt) < 0.08
      const crossesShaft = Math.abs(nx - SHAFT_X) < SHAFT_HALF - 8
      if (!crossesShaft || cabineAqui) this.px = nx
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

    // tiro do espião — em pé, ABAIXADO (rasteiro), PULANDO (alcança as
    // lâmpadas!) e até DE DENTRO do elevador
    const wantShoot = this.input.pressed(' ') || this.input.pressed('x') || this.touchShoot
    this.touchShoot = false
    if (wantShoot && this.fireTimer <= 0) {
      const y = this.groundY(this.pt) - (this.crouch ? BAIXO : ALTO) - this.jumpY
      this.shots.push({ x: this.px + this.facing * 14, y, vx: this.facing * 430, mine: true, low: this.crouch })
      this.fireTimer = 0.35
    }

    // agentes
    this.spawnTimer -= dt
    const aliveAgents = this.agents.filter((g) => g.alive).length
    if (this.spawnTimer <= 0 && aliveAgents < 2 + Math.min(this.building, 4)) {
      const myT = Math.round(this.pt)
      const doorPool = this.doors.filter((d) => Math.abs(d.t - myT) <= 1 && Math.abs(d.x - this.px) > 90)
      const door = doorPool[Math.floor(rand(0, doorPool.length))]
      if (door) {
        // prédios altos mandam AGENTES DE ELITE (vermelhos, 2 de vida)
        const elite = this.building >= 3 && rand(0, 1) < Math.min((this.building - 2) * 0.25, 0.6)
        this.agents.push({
          x: door.x,
          t: door.t,
          dir: Math.sign(this.px - door.x) || 1,
          shootTimer: rand(0.8, 1.6),
          alive: true,
          elite,
          hp: elite ? 2 : 1,
          vagar: 0,
          noElevador: false,
        })
      }
      this.spawnTimer = Math.max(2.4 - this.building * 0.25, 0.8)
    }
    const elevParado = this.cabineAlinhada()
    const elevAndar = Math.round(this.elevT)
    for (const g of this.agents) {
      if (!g.alive) continue
      if (g.vagar > 0) g.vagar -= dt

      // ---- DENTRO do elevador: viaja junto e desce quando a cabine para
      if (g.noElevador) {
        g.t = this.elevT
        g.x = SHAFT_X
        // pegou o jogador dentro da cabine? sem escapatória!
        if (onElev && this.invuln <= 0 && Math.abs(this.pt - g.t) < 0.2) this.hit()
        // desce quando a cabine PARA (nunca no mesmo instante em que
        // entrou — o "vagar" segura a viagem; chance proporcional ao tempo)
        if (elevParado && g.vagar <= 0) {
          const andarDoJogador = elevAndar === Math.round(this.pt) && !onElev
          if (andarDoJogador || rand(0, 1) < dt * 0.6) {
            g.t = elevAndar
            g.noElevador = false
            g.dir = andarDoJogador ? Math.sign(this.px - g.x) || 1 : rand(0, 1) < 0.5 ? 1 : -1
            g.x = SHAFT_X + g.dir * (SHAFT_HALF + 4)
            g.vagar = andarDoJogador ? 0 : rand(0.6, 1.2)
          }
        }
        continue
      }

      const sameFloor = g.t === Math.round(this.pt)
      // cabine parada ou CHEGANDO no meu andar e o alvo está em outro?
      // CORRE para o poço e pega o elevador!
      const querElevador =
        !sameFloor &&
        g.vagar <= 0 &&
        ((elevParado && elevAndar === g.t) || this.elevAlvo === g.t) &&
        Math.abs(g.x - SHAFT_X) < 260
      // persegue o jogador — mas respeita o "vagar" (depois de bater em algo)
      if (sameFloor && g.vagar <= 0) g.dir = Math.sign(this.px - g.x) || g.dir
      else if (querElevador) g.dir = Math.sign(SHAFT_X - g.x) || 1
      g.x += g.dir * (g.elite ? 115 : 80) * (querElevador ? 1.7 : 1) * dt
      // PAREDE: dá meia-volta e segue patrulhando (nada de ficar preso!)
      if (g.x <= WALL + 12 || g.x >= ELEV_W - WALL - 12) {
        g.x = clamp(g.x, WALL + 12, ELEV_W - WALL - 12)
        g.dir *= -1
        g.vagar = rand(0.8, 1.6)
      }
      // POÇO: cabine PARADA aqui → EMBARCA; cabine a caminho → ESPERA na
      // porta; senão dá meia-volta e patrulha
      if (Math.abs(g.x - SHAFT_X) < SHAFT_HALF - 4) {
        if (elevParado && elevAndar === g.t) {
          g.noElevador = true
          g.x = SHAFT_X
          g.vagar = 1.5 // fica a bordo pelo menos até a PRÓXIMA parada
          continue
        }
        g.x = g.x < SHAFT_X ? SHAFT_X - SHAFT_HALF + 4 : SHAFT_X + SHAFT_HALF - 4
        if (this.elevAlvo !== g.t) {
          g.dir *= -1
          g.vagar = rand(0.8, 1.6)
        }
      }
      g.shootTimer -= dt
      if (sameFloor && g.shootTimer <= 0 && Math.abs(g.x - this.px) < 280) {
        const bulletSpeed = (g.elite ? 320 : 250) + this.building * 12
        // elite atira RASTEIRO às vezes — abaixar não é colete à prova de tudo
        const low = g.elite && rand(0, 1) < 0.35
        this.shots.push({
          x: g.x + g.dir * 12,
          y: this.groundY(g.t) - (low ? BAIXO : ALTO),
          vx: g.dir * bulletSpeed,
          mine: false,
          low,
        })
        g.shootTimer = Math.max(rand(1.2, 2.2) - this.building * 0.1 - (g.elite ? 0.4 : 0), 0.45)
      }
      // contato direto
      if (sameFloor && this.invuln <= 0 && Math.abs(g.x - this.px) < 18) this.hit()
    }

    // balas
    for (const s of this.shots) s.x += s.vx * dt
    this.shots = this.shots.filter((s) => s.x > WALL && s.x < ELEV_W - WALL)
    for (const s of this.shots) {
      if (s.mine) {
        // acertou uma LÂMPADA? (tiro dado no alto, durante o pulo)
        for (const l of this.lampadas) {
          if (l.quebrada) continue
          const lampY = this.groundY(l.t) - FLOOR_H + 23
          if (Math.abs(s.y - lampY) < 11 && Math.abs(s.x - l.x) < 12) {
            l.quebrada = true
            s.x = -999
            this.points += 50
            this.texts.add(l.x, lampY - 10, '💡 +50', '#FFC53D', 13)
            this.shake.kick(3)
            for (let k = 0; k < 8; k++) {
              this.particles.list.push({
                x: l.x, y: lampY, vx: rand(-90, 90), vy: rand(20, 140),
                life: rand(0.3, 0.6), maxLife: 0.6, color: '#FFD873', size: rand(1.5, 3),
              })
            }
            this.pushHud()
            break
          }
        }
        if (s.x === -999) continue
        for (const g of this.agents) {
          if (!g.alive || Math.abs(this.groundY(g.t) - ALTO - s.y) > 30) continue
          if (Math.abs(g.x - s.x) < 14) {
            g.hp--
            s.x = -999
            if (g.hp > 0) {
              this.texts.add(g.x, s.y - 12, '💢', '#E8455A', 14)
              break
            }
            g.alive = false
            const pts = g.elite ? 250 : 100
            this.points += pts
            this.texts.add(g.x, s.y - 12, `+${pts}`, '#33E0D6', 14)
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
        // ABAIXADO esquiva do tiro alto; PULANDO passa por cima dos dois;
        // tiro rasteiro pega quem abaixou E quem está de pé
        const esquivou = (this.crouch && !s.low) || this.jumpY > 24
        const py = this.groundY(this.pt) - (s.low ? BAIXO : ALTO)
        if (!esquivou && Math.abs(s.y - py) < 16 && Math.abs(s.x - this.px) < 12) {
          s.x = -999
          this.hit()
        } else if (esquivou && Math.abs(s.x - this.px) < 12 && Math.abs(s.y - (this.groundY(this.pt) - ALTO)) < 16) {
          // a bala passou zunindo por cima da cabeça
          this.texts.add(this.px, this.groundY(this.pt) - 44, 'fiu!', '#FFC53D', 11)
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
    // céu noturno com lua e skyline ao fundo
    const sky = ctx.createLinearGradient(0, 0, 0, ELEV_H)
    sky.addColorStop(0, '#0B0720')
    sky.addColorStop(0.5, '#140E26')
    sky.addColorStop(1, '#1E1440')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, ELEV_W, ELEV_H)
    withGlow(ctx, '#FFF9F0', 18, () => {
      ctx.fillStyle = '#FFF3D6'
      ctx.beginPath()
      ctx.arc(ELEV_W - 70, 64, 22, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(20,14,38,0.9)'
    for (const [bx, bw, bh] of [[0, 40, 210], [30, 34, 150], [ELEV_W - 44, 44, 240], [ELEV_W - 90, 30, 130]] as const) {
      ctx.fillRect(bx, ELEV_H - bh, bw, bh)
    }
    ctx.fillStyle = 'rgba(255,197,61,0.35)'
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(8 + (i % 2) * 16, ELEV_H - 190 + i * 17, 6, 6)
      ctx.fillRect(ELEV_W - 34 + (i % 2) * 12, ELEV_H - 220 + i * 19, 6, 6)
    }

    const camY = clamp(this.groundY(this.pt) - ELEV_H * 0.55, 0, this.groundY(this.floors - 1) + 60 - ELEV_H)
    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y - camY)

    const bottom = this.groundY(this.floors - 1)

    // corpo do prédio + telhado
    ctx.fillStyle = '#241A42'
    ctx.fillRect(WALL - 14, 40, ELEV_W - (WALL - 14) * 2, bottom - 20)
    ctx.fillStyle = '#171029'
    ctx.fillRect(WALL - 20, 26, ELEV_W - (WALL - 20) * 2, 18)
    ctx.fillStyle = '#3A2A6B'
    ctx.fillRect(WALL + 30, 12, 26, 16)

    for (let t = 0; t < this.floors; t++) {
      const y = this.groundY(t)
      const garage = t === this.floors - 1
      // parede do andar com faixa (papel de parede alternado)
      ctx.fillStyle = t % 2 === 0 ? 'rgba(157,92,255,0.05)' : 'rgba(51,224,214,0.04)'
      ctx.fillRect(WALL - 14, y - FLOOR_H + 10, ELEV_W - (WALL - 14) * 2, FLOOR_H - 10)
      ctx.fillStyle = 'rgba(255,249,240,0.05)'
      ctx.fillRect(WALL - 14, y - 34, ELEV_W - (WALL - 14) * 2, 2) // rodapé
      // laje com borda iluminada
      ctx.fillStyle = '#3A2A6B'
      ctx.fillRect(WALL - 14, y, ELEV_W - (WALL - 14) * 2, 10)
      ctx.fillStyle = 'rgba(255,249,240,0.10)'
      ctx.fillRect(WALL - 14, y, ELEV_W - (WALL - 14) * 2, 2)
      // número do andar
      ctx.font = '800 10px "Baloo 2 Variable", sans-serif'
      ctx.fillStyle = 'rgba(244,239,255,0.35)'
      ctx.textAlign = 'left'
      ctx.fillText(garage ? 'G' : `${this.floors - 1 - t}`, WALL - 6, y - FLOOR_H + 26)
      if (garage) {
        // garagem: piso listrado + carro da fuga
        ctx.fillStyle = 'rgba(51,224,214,0.10)'
        ctx.fillRect(WALL - 14, y - FLOOR_H + 10, ELEV_W - (WALL - 14) * 2, FLOOR_H - 10)
        ctx.strokeStyle = 'rgba(255,197,61,0.35)'
        ctx.lineWidth = 3
        ctx.setLineDash([12, 10])
        ctx.beginPath()
        ctx.moveTo(WALL, y - 4)
        ctx.lineTo(ELEV_W - WALL, y - 4)
        ctx.stroke()
        ctx.setLineDash([])
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
      // portas com moldura e plaquinha
      for (const d of this.doors.filter((dd) => dd.t === t)) {
        const dy = y - 52
        const color = d.kind === 'doc' ? '#E8455A' : d.kind === 'coletada' ? '#4A4160' : '#4A5BD4'
        if (d.kind === 'doc') {
          withGlow(ctx, '#E8455A', 10, () => this.door(ctx, d.x, dy, color))
        } else {
          this.door(ctx, d.x, dy, color)
        }
      }
      // luminárias penduradas (as quebradas ficam apagadas)
      for (const l of this.lampadas.filter((ll) => ll.t === t)) {
        ctx.strokeStyle = 'rgba(255,249,240,0.25)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(l.x, y - FLOOR_H + 10)
        ctx.lineTo(l.x, y - FLOOR_H + 20)
        ctx.stroke()
        if (l.quebrada) {
          ctx.fillStyle = '#3A3352'
          ctx.beginPath()
          ctx.arc(l.x, y - FLOOR_H + 23, 4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          withGlow(ctx, '#FFC53D', 10, () => {
            ctx.fillStyle = '#FFC53D'
            ctx.beginPath()
            ctx.arc(l.x, y - FLOOR_H + 23, 4, 0, Math.PI * 2)
            ctx.fill()
          })
        }
      }
    }

    // poço do elevador com trilhos e cabos
    ctx.fillStyle = '#100B20'
    ctx.fillRect(SHAFT_X - SHAFT_HALF, 44, SHAFT_HALF * 2, bottom - 34)
    ctx.strokeStyle = '#5A3DA8'
    ctx.lineWidth = 3
    ctx.strokeRect(SHAFT_X - SHAFT_HALF, 44, SHAFT_HALF * 2, bottom - 34)
    ctx.setLineDash([6, 10])
    ctx.strokeStyle = 'rgba(157,92,255,0.35)'
    ctx.beginPath()
    ctx.moveTo(SHAFT_X - SHAFT_HALF + 8, 44)
    ctx.lineTo(SHAFT_X - SHAFT_HALF + 8, bottom)
    ctx.moveTo(SHAFT_X + SHAFT_HALF - 8, 44)
    ctx.lineTo(SHAFT_X + SHAFT_HALF - 8, bottom)
    ctx.stroke()
    ctx.setLineDash([])

    // cabine com cabo, janelinha e seta de direção
    const ey = this.groundY(this.elevT)
    ctx.strokeStyle = 'rgba(244,239,255,0.4)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(SHAFT_X - 12, 44)
    ctx.lineTo(SHAFT_X - 12, ey - 62)
    ctx.moveTo(SHAFT_X + 12, 44)
    ctx.lineTo(SHAFT_X + 12, ey - 62)
    ctx.stroke()
    const aberta = this.cabineAlinhada()
    withGlow(ctx, aberta ? '#FFC53D' : '#7A6EA8', aberta ? 10 : 4, () => {
      const cab = ctx.createLinearGradient(0, ey - 62, 0, ey)
      cab.addColorStop(0, '#4A3684')
      cab.addColorStop(1, '#2C2052')
      ctx.fillStyle = cab
      ctx.fillRect(SHAFT_X - SHAFT_HALF + 6, ey - 62, SHAFT_HALF * 2 - 12, 62)
      ctx.fillStyle = aberta ? '#FFC53D' : '#7A6EA8'
      ctx.fillRect(SHAFT_X - SHAFT_HALF + 6, ey - 6, SHAFT_HALF * 2 - 12, 6)
      ctx.strokeStyle = aberta ? '#FFC53D' : '#7A6EA8'
      ctx.lineWidth = 2
      ctx.strokeRect(SHAFT_X - SHAFT_HALF + 6, ey - 62, SHAFT_HALF * 2 - 12, 62)
    })
    // janelinha + indicador de direção
    ctx.fillStyle = 'rgba(255,249,240,0.14)'
    ctx.fillRect(SHAFT_X - 14, ey - 54, 28, 12)
    ctx.fillStyle = aberta ? '#55E07F' : '#FFC53D'
    ctx.font = '800 12px "Baloo 2 Variable", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(aberta ? '▶ ◀' : this.elevDir > 0 ? '▼' : '▲', SHAFT_X, ey - 30)

    // agentes (elite = terno vermelho)
    for (const g of this.agents) {
      if (g.alive) {
        this.person(ctx, g.x, this.groundY(g.t), g.elite ? '#C2334B' : '#4A4160', g.elite ? '#8A1F33' : '#2A2140', g.dir, false, false)
      }
    }

    // balas (rasteiras voam mais baixo, com risquinho no chão)
    for (const s of this.shots) {
      withGlow(ctx, s.mine ? '#33E0D6' : '#F252C1', 8, () => {
        ctx.fillStyle = s.mine ? '#7CF5EC' : '#F252C1'
        ctx.fillRect(s.x - 5, s.y - 2, 10, 4)
      })
      if (s.low) {
        ctx.fillStyle = 'rgba(255,249,240,0.15)'
        ctx.fillRect(s.x - 8, s.y + 6, 16, 1.5)
      }
    }

    // espião (pisca quando invulnerável; agachado quando abaixa; PULA!)
    if (this.invuln <= 0 || Math.floor(this.time * 10) % 2 === 0) {
      this.person(ctx, this.px, this.groundY(this.pt) - this.jumpY, '#9D5CFF', '#5A3DA8', this.facing, true, this.crouch)
    }

    // ÁREAS ESCURAS: lâmpada quebrada apaga aquele trecho do andar
    // (escurece tudo — portas, agentes e o próprio espião, como no clássico)
    for (const l of this.lampadas) {
      if (!l.quebrada) continue
      const y = this.groundY(l.t)
      const escuro = ctx.createRadialGradient(l.x, y - FLOOR_H / 2, 30, l.x, y - FLOOR_H / 2, 150)
      escuro.addColorStop(0, 'rgba(4,2,12,0.72)')
      escuro.addColorStop(1, 'rgba(4,2,12,0)')
      ctx.fillStyle = escuro
      ctx.fillRect(l.x - 150, y - FLOOR_H + 10, 300, FLOOR_H - 10)
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()
    drawVignette(ctx, ELEV_W, ELEV_H, 0.4)
  }

  private door(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    // moldura
    ctx.fillStyle = 'rgba(255,249,240,0.10)'
    ctx.beginPath()
    ctx.roundRect(x - 17, y - 3, 34, 57, 5)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x - 14, y, 28, 52, 4)
    ctx.fill()
    // vidrinho e plaquinha
    ctx.fillStyle = 'rgba(20,14,38,0.4)'
    ctx.beginPath()
    ctx.roundRect(x - 9, y + 6, 18, 18, 3)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,249,240,0.25)'
    ctx.fillRect(x - 6, y - 1, 12, 2)
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
    spy: boolean,
    crouch: boolean,
  ) {
    const run = Math.sin(this.time * 11 + x * 0.1) * 4
    ctx.save()
    ctx.translate(x, groundY)
    // sombra no chão
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(0, 1, 11, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    if (crouch) ctx.translate(0, 12)
    // pernas
    ctx.strokeStyle = dark
    ctx.lineWidth = 4.5
    ctx.beginPath()
    if (crouch) {
      ctx.moveTo(0, -12)
      ctx.lineTo(-7, -4)
      ctx.lineTo(-5, 0 - 12 + 12)
      ctx.moveTo(0, -12)
      ctx.lineTo(7, -4)
      ctx.lineTo(5, 0)
    } else {
      ctx.moveTo(0, -12)
      ctx.lineTo(-4 + run * 0.4, 0)
      ctx.moveTo(0, -12)
      ctx.lineTo(4 - run * 0.4, 0)
    }
    ctx.stroke()
    // tronco
    const g = ctx.createLinearGradient(0, -40, 0, -8)
    g.addColorStop(0, suit)
    g.addColorStop(1, dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(-8, crouch ? -32 : -40, 16, crouch ? 22 : 30, 5)
    ctx.fill()
    // braço + arma apontada (na altura certa)
    const armY = crouch ? -22 : -30
    ctx.strokeStyle = dark
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(0, armY + 4)
    ctx.lineTo(dir * 10, armY + 2)
    ctx.stroke()
    ctx.fillStyle = '#171029'
    ctx.fillRect(dir > 0 ? 6 : -16, armY, 10, 3.5)
    // cabeça + chapéu
    const headY = crouch ? -38 : -46
    ctx.fillStyle = '#FFD9B8'
    ctx.beginPath()
    ctx.arc(0, headY, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = spy ? dark : '#171029'
    ctx.beginPath()
    ctx.ellipse(0, headY - 4, 9.5, 3, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(-6, headY - 9, 12, 5)
    if (spy) {
      // óculos escuros de espião
      ctx.fillStyle = '#140E26'
      ctx.fillRect(dir > 0 ? -2 : -6, headY - 2, 8, 3)
    }
    ctx.restore()
  }
}
