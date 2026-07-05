/**
 * Puzzle — quebra-cabeça de TROCAR peças: a imagem (100% procedural)
 * é fatiada e embaralhada; toque em duas peças para trocá-las de lugar.
 * Menos trocas e menos tempo = mais pontos. 3 níveis, grades maiores.
 */
import {
  drawVignette,
  rand,
  withGlow,
  FloatingTexts,
  Input,
  Particles,
  type GameHost,
} from '../engine/core'

export const PUZZLE_W = 720
export const PUZZLE_H = 520

const NIVEIS = [
  { cols: 3, rows: 2, base: 600 },
  { cols: 4, rows: 3, base: 1200 },
  { cols: 5, rows: 4, base: 2200 },
]

export class PuzzleGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()

  private nivel = 0
  private ordem: number[] = [] // posição → peça original
  private sel = -1
  private moves = 0
  private points = 0
  private time = 0
  private nivelTime = 0
  private img: HTMLCanvasElement
  private over = false
  private overDelay = 0
  private celebrando = 0
  private lastDownAt = 0

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.img = document.createElement('canvas')
    this.montaNivel()
    this.pushHud()
  }

  private cfg() {
    return NIVEIS[this.nivel]!
  }

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      weapon: `nível ${this.nivel + 1}/3 · ${this.moves} trocas`,
    })
  }

  private montaNivel() {
    const { cols, rows } = this.cfg()
    this.pintaImagem()
    const n = cols * rows
    this.ordem = Array.from({ length: n }, (_, i) => i)
    // embaralha até ficar visivelmente fora de ordem
    do {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1))
        ;[this.ordem[i], this.ordem[j]] = [this.ordem[j]!, this.ordem[i]!]
      }
    } while (this.ordem.every((p, i) => p === i))
    this.sel = -1
    this.moves = 0
    this.nivelTime = 0
    this.celebrando = 0
  }

  /** três cenas Mesa Pop, uma por nível — tudo desenhado na hora */
  private pintaImagem() {
    this.img.width = PUZZLE_W
    this.img.height = PUZZLE_H
    const ctx = this.img.getContext('2d')!
    if (this.nivel === 0) {
      // pôr-do-sol
      const sky = ctx.createLinearGradient(0, 0, 0, PUZZLE_H)
      sky.addColorStop(0, '#2E1B5B')
      sky.addColorStop(0.6, '#B85CD6')
      sky.addColorStop(1, '#FF8244')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, PUZZLE_W, PUZZLE_H)
      ctx.fillStyle = '#FFD873'
      ctx.beginPath()
      ctx.arc(PUZZLE_W / 2, PUZZLE_H * 0.62, 70, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1B1235'
      for (const [x, h] of [[80, 150], [240, 220], [430, 180], [600, 240]] as const) {
        ctx.beginPath()
        ctx.moveTo(x - 130, PUZZLE_H)
        ctx.lineTo(x, PUZZLE_H - h)
        ctx.lineTo(x + 130, PUZZLE_H)
        ctx.closePath()
        ctx.fill()
      }
    } else if (this.nivel === 1) {
      // fundo do mar
      const sea = ctx.createLinearGradient(0, 0, 0, PUZZLE_H)
      sea.addColorStop(0, '#0E4B6B')
      sea.addColorStop(1, '#071F30')
      ctx.fillStyle = sea
      ctx.fillRect(0, 0, PUZZLE_W, PUZZLE_H)
      for (let i = 0; i < 8; i++) {
        const x = 60 + i * 85
        ctx.fillStyle = ['#F252C1', '#FFC53D', '#33E0D6', '#55E07F'][i % 4]!
        ctx.beginPath()
        ctx.ellipse(x, 140 + (i % 3) * 110, 34, 18, i % 2 ? 0.3 : -0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x - 30, 140 + (i % 3) * 110)
        ctx.lineTo(x - 52, 128 + (i % 3) * 110)
        ctx.lineTo(x - 52, 152 + (i % 3) * 110)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#140E26'
        ctx.beginPath()
        ctx.arc(x + 18, 136 + (i % 3) * 110, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#2E8B4A'
      for (let x = 20; x < PUZZLE_W; x += 90) {
        ctx.beginPath()
        ctx.moveTo(x, PUZZLE_H)
        ctx.quadraticCurveTo(x + 20, PUZZLE_H - 90, x - 8, PUZZLE_H - 150)
        ctx.quadraticCurveTo(x + 26, PUZZLE_H - 90, x + 16, PUZZLE_H)
        ctx.fill()
      }
    } else {
      // espaço
      ctx.fillStyle = '#0B0720'
      ctx.fillRect(0, 0, PUZZLE_W, PUZZLE_H)
      for (let i = 0; i < 130; i++) {
        ctx.fillStyle = `rgba(244,239,255,${rand(0.3, 1)})`
        ctx.fillRect(rand(0, PUZZLE_W), rand(0, PUZZLE_H), 2, 2)
      }
      const pg = ctx.createRadialGradient(430, 250, 20, 430, 250, 110)
      pg.addColorStop(0, '#F252C1')
      pg.addColorStop(1, '#6B2E9E')
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(430, 250, 100, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#FFC53D'
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.ellipse(430, 250, 160, 40, -0.35, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#33E0D6'
      ctx.beginPath()
      ctx.moveTo(120, 380)
      ctx.lineTo(180, 340)
      ctx.lineTo(180, 420)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#FFF9F0'
      ctx.beginPath()
      ctx.roundRect(170, 350, 90, 60, 24)
      ctx.fill()
    }
    // marca d'água pop
    ctx.fillStyle = 'rgba(255,249,240,0.16)'
    ctx.font = '800 26px "Baloo 2 Variable", sans-serif'
    ctx.fillText('mesa pop', PUZZLE_W - 150, PUZZLE_H - 18)
  }

  update(dt: number) {
    this.time += dt
    this.nivelTime += dt
    this.particles.update(dt)
    this.texts.update(dt)

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }
    if (this.celebrando > 0) {
      this.celebrando -= dt
      if (this.celebrando <= 0) {
        if (this.nivel >= NIVEIS.length - 1) {
          this.over = true
          this.overDelay = 0.8
        } else {
          this.nivel++
          this.montaNivel()
          this.pushHud()
        }
      }
      return
    }

    // toque: seleciona/troca (detecção por carimbo — não perde cliques)
    if (this.input.downAt !== this.lastDownAt) {
      this.lastDownAt = this.input.downAt
      const p = this.input.hover
      if (!p) return
      const { cols, rows } = this.cfg()
      const pw = PUZZLE_W / cols
      const ph = PUZZLE_H / rows
      const cx = Math.floor(p.x / pw)
      const cy = Math.floor(p.y / ph)
      if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return
      const idx = cy * cols + cx
      if (this.sel === -1) {
        this.sel = idx
      } else if (this.sel === idx) {
        this.sel = -1
      } else {
        ;[this.ordem[this.sel], this.ordem[idx]] = [this.ordem[idx]!, this.ordem[this.sel]!]
        this.sel = -1
        this.moves++
        this.pushHud()
        if (this.ordem.every((piece, i) => piece === i)) this.completou()
      }
    }
  }

  private completou() {
    const { base } = this.cfg()
    const ganho = Math.max(base - this.moves * 15 - Math.floor(this.nivelTime) * 4, 120)
    this.points += ganho
    this.texts.add(PUZZLE_W / 2, PUZZLE_H / 2, `MONTADO! +${ganho}`, '#FFC53D', 30)
    for (let k = 0; k < 60; k++) {
      this.particles.list.push({
        x: rand(0, PUZZLE_W),
        y: rand(-30, 0),
        vx: rand(-30, 30),
        vy: rand(90, 220),
        life: rand(0.8, 1.5),
        maxLife: 1.5,
        color: ['#F252C1', '#FFC53D', '#33E0D6', '#55E07F', '#9D5CFF'][k % 5]!,
        size: rand(3, 6),
      })
    }
    this.celebrando = 1.6
    this.pushHud()
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#171029'
    ctx.fillRect(0, 0, PUZZLE_W, PUZZLE_H)

    const { cols, rows } = this.cfg()
    const pw = PUZZLE_W / cols
    const ph = PUZZLE_H / rows
    const montado = this.celebrando > 0 || this.over

    for (let pos = 0; pos < cols * rows; pos++) {
      const piece = this.ordem[pos]!
      const dx = (pos % cols) * pw
      const dy = Math.floor(pos / cols) * ph
      const sx = (piece % cols) * pw
      const sy = Math.floor(piece / cols) * ph
      const gap = montado ? 0 : 3
      ctx.drawImage(this.img, sx, sy, pw, ph, dx + gap, dy + gap, pw - gap * 2, ph - gap * 2)
      if (!montado) {
        if (pos === this.sel) {
          withGlow(ctx, '#33E0D6', 14, () => {
            ctx.strokeStyle = '#33E0D6'
            ctx.lineWidth = 4
            ctx.strokeRect(dx + 3, dy + 3, pw - 6, ph - 6)
          })
        } else if (piece === pos) {
          // peça no lugar certo: cantinho verde discreto
          ctx.fillStyle = 'rgba(85,224,127,0.9)'
          ctx.beginPath()
          ctx.arc(dx + pw - 12, dy + 12, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    this.particles.draw(ctx)
    this.texts.draw(ctx)
    if (!montado) drawVignette(ctx, PUZZLE_W, PUZZLE_H, 0.2)
  }
}
