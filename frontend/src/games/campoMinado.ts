/**
 * Campo Minado — lógica pura com acabamento Mesa Pop:
 * 1º clique SEMPRE seguro, células como pastilhas 3D, números na paleta,
 * bandeira por toque longo (ou modo bandeira no botão), explosão em cadeia
 * ao perder e chuva de confete ao vencer.
 * Pontos: +5 por casa revelada; vencer = bônus que derrete com o tempo.
 */
import {
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

export const MINAS_COLS = 14
export const MINAS_ROWS = 10
const CELL = 44
export const MINAS_W = MINAS_COLS * CELL
export const MINAS_H = MINAS_ROWS * CELL
const MINES = 22

const NUM_COLORS = ['', '#33E0D6', '#55E07F', '#FFC53D', '#F252C1', '#FF8244', '#9D5CFF', '#E8455A', '#FFF9F0']

interface Tile {
  mine: boolean
  revealed: boolean
  flagged: boolean
  around: number
}

export class CampoMinadoGame implements GameHost {
  input = new Input()
  private particles = new Particles()
  private texts = new FloatingTexts()
  private shake = new ScreenShake()
  private waves = new Shockwaves()

  private grid: Tile[] = []
  private planted = false
  private points = 0
  private flags = 0
  private time = 0
  private over = false
  private won = false
  private overDelay = 0
  flagMode = false

  // clique/toque: detectado pelo carimbo downAt (não perde toques rápidos
  // que começam E terminam entre dois frames)
  private lastDownAt = 0
  private pressing = false
  private pressCell = -1
  private longDone = false

  constructor(
    private cb: {
      onGameOver(points: number): void
      onHud(hud: Record<string, unknown>): void
    },
  ) {
    this.grid = Array.from({ length: MINAS_COLS * MINAS_ROWS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      around: 0,
    }))
    this.pushHud()
  }

  toggleFlagMode() {
    this.flagMode = !this.flagMode
    this.pushHud()
  }

  private pushHud() {
    this.cb.onHud({
      points: this.points,
      weapon: `🚩 ${this.flags}/${MINES}${this.flagMode ? ' · MODO BANDEIRA' : ''}`,
      flagMode: this.flagMode,
    })
  }

  private neighbors(i: number): number[] {
    const x = i % MINAS_COLS
    const y = Math.floor(i / MINAS_COLS)
    const out: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < MINAS_COLS && ny >= 0 && ny < MINAS_ROWS) out.push(ny * MINAS_COLS + nx)
      }
    }
    return out
  }

  /** minas entram DEPOIS do 1º clique — nunca na casa clicada nem ao redor */
  private plant(safe: number) {
    const banned = new Set([safe, ...this.neighbors(safe)])
    let placed = 0
    while (placed < MINES) {
      const i = Math.floor(rand(0, this.grid.length))
      if (banned.has(i) || this.grid[i]!.mine) continue
      this.grid[i]!.mine = true
      placed++
    }
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i]!.around = this.neighbors(i).filter((n) => this.grid[n]!.mine).length
    }
    this.planted = true
  }

  private reveal(i: number) {
    const t = this.grid[i]!
    if (t.revealed || t.flagged) return
    if (!this.planted) this.plant(i)
    if (t.mine) {
      this.explode(i)
      return
    }
    // revelação em cadeia (flood fill) a partir dos zeros
    const stack = [i]
    let gained = 0
    while (stack.length) {
      const j = stack.pop()!
      const tile = this.grid[j]!
      if (tile.revealed || tile.flagged || tile.mine) continue
      tile.revealed = true
      gained += 5
      if (tile.around === 0) stack.push(...this.neighbors(j))
    }
    this.points += gained
    if (gained > 5) {
      const x = ((i % MINAS_COLS) + 0.5) * CELL
      const y = (Math.floor(i / MINAS_COLS) + 0.5) * CELL
      this.texts.add(x, y, `+${gained}`, '#55E07F', 16)
    }
    this.pushHud()

    // venceu? (todas as casas seguras reveladas)
    if (this.grid.every((c) => c.mine || c.revealed)) this.win()
  }

  private toggleFlag(i: number) {
    const t = this.grid[i]!
    if (t.revealed) return
    if (!t.flagged && this.flags >= MINES) return
    t.flagged = !t.flagged
    this.flags += t.flagged ? 1 : -1
    this.pushHud()
  }

  private explode(at: number) {
    this.over = true
    this.won = false
    this.overDelay = 1.6
    this.grid.forEach((t) => {
      if (t.mine) t.revealed = true
    })
    this.shake.kick(14)
    const x = ((at % MINAS_COLS) + 0.5) * CELL
    const y = (Math.floor(at / MINAS_COLS) + 0.5) * CELL
    this.waves.add(x, y, 80, '#FF8244')
    for (let k = 0; k < 40; k++) {
      this.particles.list.push({
        x,
        y,
        vx: rand(-220, 220),
        vy: rand(-220, 220),
        life: rand(0.3, 0.9),
        maxLife: 0.9,
        color: k % 2 ? '#FF8244' : '#FFC53D',
        size: rand(2.5, 6),
      })
    }
  }

  private win() {
    this.over = true
    this.won = true
    this.overDelay = 1.6
    const bonus = Math.max(500 - Math.floor(this.time) * 4, 100)
    this.points += bonus
    this.texts.add(MINAS_W / 2, MINAS_H / 2, `LIMPO! +${bonus}`, '#FFC53D', 30)
    for (let k = 0; k < 70; k++) {
      this.particles.list.push({
        x: rand(0, MINAS_W),
        y: rand(-40, 0),
        vx: rand(-30, 30),
        vy: rand(80, 220),
        life: rand(0.8, 1.6),
        maxLife: 1.6,
        color: NUM_COLORS[1 + (k % 7)]!,
        size: rand(3, 6),
      })
    }
    this.pushHud()
  }

  private cellAt(p: { x: number; y: number } | null): number {
    if (!p) return -1
    const x = Math.floor(p.x / CELL)
    const y = Math.floor(p.y / CELL)
    if (x < 0 || x >= MINAS_COLS || y < 0 || y >= MINAS_ROWS) return -1
    return y * MINAS_COLS + x
  }

  update(dt: number) {
    this.time += dt
    this.particles.update(dt)
    this.texts.update(dt)
    this.shake.update(dt)
    this.waves.update(dt)

    if (this.over) {
      this.overDelay -= dt
      if (this.overDelay <= 0) {
        this.over = false
        this.cb.onGameOver(this.points)
      }
      return
    }

    const now = performance.now()
    // nova pressão desde o último frame? (downAt muda a cada pointerdown)
    if (this.input.downAt !== this.lastDownAt) {
      this.lastDownAt = this.input.downAt
      this.pressing = true
      this.pressCell = this.cellAt(this.input.hover)
      this.longDone = false
    }
    // toque longo (350ms parado) = bandeira
    if (this.pressing && this.input.isDown && !this.longDone && now - this.input.downAt > 350) {
      if (this.pressCell >= 0 && this.cellAt(this.input.hover) === this.pressCell) {
        this.toggleFlag(this.pressCell)
        this.longDone = true
      }
    }
    // soltou (mesmo que down+up tenham acontecido no mesmo frame)
    if (this.pressing && !this.input.isDown) {
      this.pressing = false
      const cell = this.pressCell
      if (!this.longDone && cell >= 0 && this.cellAt(this.input.hover) === cell) {
        if (this.flagMode) this.toggleFlag(cell)
        else this.reveal(cell)
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#171029'
    ctx.fillRect(0, 0, MINAS_W, MINAS_H)

    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    const hoverCell = this.over ? -1 : this.cellAt(this.input.hover)

    for (let i = 0; i < this.grid.length; i++) {
      const t = this.grid[i]!
      const x = (i % MINAS_COLS) * CELL
      const y = Math.floor(i / MINAS_COLS) * CELL

      if (t.revealed) {
        // casa aberta: afundada
        ctx.fillStyle = t.mine ? '#3A1220' : (i % MINAS_COLS) % 2 === Math.floor(i / MINAS_COLS) % 2 ? '#231A3E' : '#251C42'
        ctx.beginPath()
        ctx.roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, 7)
        ctx.fill()
        if (t.mine) {
          withGlow(ctx, '#FF8244', 10, () => {
            ctx.font = `${CELL * 0.52}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('💣', x + CELL / 2, y + CELL / 2 + 1)
          })
        } else if (t.around > 0) {
          ctx.fillStyle = NUM_COLORS[t.around]!
          ctx.font = `800 ${CELL * 0.44}px "Baloo 2 Variable", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(t.around), x + CELL / 2, y + CELL / 2 + 1)
        }
      } else {
        // pastilha fechada com relevo
        const g = ctx.createLinearGradient(x, y, x, y + CELL)
        g.addColorStop(0, i === hoverCell ? '#8A63E8' : '#6B4BBF')
        g.addColorStop(1, i === hoverCell ? '#6B4BBF' : '#4E3591')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 9)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.beginPath()
        ctx.roundRect(x + 4, y + 4, CELL - 8, CELL * 0.28, 7)
        ctx.fill()
        if (t.flagged) {
          ctx.font = `${CELL * 0.5}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🚩', x + CELL / 2, y + CELL / 2 + 1)
        }
      }
    }

    // aviso do toque longo em progresso
    if (this.pressing && this.input.isDown && !this.longDone && this.pressCell >= 0 && !this.flagMode) {
      const held = (performance.now() - this.input.downAt) / 350
      if (held > 0.25 && held < 1) {
        const x = ((this.pressCell % MINAS_COLS) + 0.5) * CELL
        const y = (Math.floor(this.pressCell / MINAS_COLS) + 0.5) * CELL
        ctx.strokeStyle = '#FFC53D'
        ctx.lineWidth = 3.5
        ctx.beginPath()
        ctx.arc(x, y, CELL * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.min(held, 1) * Math.PI * 2)
        ctx.stroke()
      }
    }

    this.waves.draw(ctx)
    this.particles.draw(ctx)
    this.texts.draw(ctx)
    ctx.restore()

    // brilho dourado enquanto a vitória é celebrada
    if (this.over && this.won) {
      ctx.fillStyle = 'rgba(255,197,61,0.08)'
      ctx.fillRect(0, 0, MINAS_W, MINAS_H)
    }
    drawVignette(ctx, MINAS_W, MINAS_H, 0.25)
  }
}
