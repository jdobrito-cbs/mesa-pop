/**
 * Cobra Arena (clone do slither.io) — SIMULAÇÃO AUTORITATIVA NO SERVIDOR.
 * O cliente só manda a mira (ângulo) e o boost; aqui movemos todas as cobras,
 * comemos comida, crescemos, checamos colisões/mortes e povoamos a arena com
 * cobras da IA. Vence a MAIOR cobra ao fim do tempo.
 */
import {
  COBRA_DURACAO,
  COBRA_RAIO,
  COBRA_SEG,
  type CobraAction,
  type CobraFoodView,
  type CobraSnakeView,
  type CobraSnapshot,
} from '@mesapop/shared'
import type { GameModule } from './module'

const BASE_SPEED = 140
const BOOST_SPEED = 250
const TURN = 4.3
const MIN_TAM = 8
const START_TAM = 14
const DRAIN = 6 // segmentos/s gastos no boost
const FOOD_ALVO = 260
const VIEW_MAX = 90 // anéis do corpo enviados por cobra

const CORES = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399', '#a855f7', '#fb923c', '#38bdf8', '#f472b6']
const NOMES_IA = ['Víbora', 'Naja', 'Píton', 'Cascavel', 'Jibóia', 'Anaconda', 'Cobrão', 'Serpente']

interface Ponto {
  x: number
  y: number
}
interface Food extends Ponto {
  r: number
  c: string
  v: number
}
interface Snake {
  id: string
  seat: number | null
  nome: string
  cor: string
  vivo: boolean
  boost: boolean
  aim: number
  angle: number
  pts: Ponto[]
  tam: number
  best: number
  respawn: number
  ai: boolean
  aiTimer: number
}

export interface CobraState {
  time: number
  snakes: Snake[]
  food: Food[]
  finished: boolean
  winnerSeats: number[]
  draw: boolean
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const raioDe = (tam: number) => 7 + Math.min(tam, 400) * 0.025
const dist2 = (a: Ponto, b: Ponto) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function pontoLivre(snakes: Snake[]): Ponto {
  for (let t = 0; t < 30; t++) {
    const ang = rand(0, Math.PI * 2)
    const r = rand(0, COBRA_RAIO * 0.75)
    const p = { x: Math.cos(ang) * r, y: Math.sin(ang) * r }
    const perto = snakes.some((s) => s.vivo && s.pts[0] && dist2(s.pts[0], p) < 200 ** 2)
    if (!perto) return p
  }
  return { x: rand(-200, 200), y: rand(-200, 200) }
}

function nascer(snake: Snake, snakes: Snake[]) {
  const cabeca = pontoLivre(snakes)
  snake.angle = rand(0, Math.PI * 2)
  snake.aim = snake.angle
  snake.tam = START_TAM
  snake.vivo = true
  snake.boost = false
  snake.pts = []
  for (let i = 0; i < START_TAM; i++) {
    snake.pts.push({ x: cabeca.x - Math.cos(snake.angle) * i * COBRA_SEG, y: cabeca.y - Math.sin(snake.angle) * i * COBRA_SEG })
  }
}

function novaFood(): Food {
  const ang = rand(0, Math.PI * 2)
  const r = rand(0, COBRA_RAIO * 0.97)
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r, r: 5, c: CORES[Math.floor(rand(0, CORES.length))]!, v: 1 }
}

export function initialCobraState(playerCount: number): CobraState {
  const snakes: Snake[] = []
  for (let s = 0; s < playerCount; s++) {
    snakes.push(mkSnake(`s${s}`, s, `Jogador ${s + 1}`, CORES[s % CORES.length]!, false))
  }
  const totalAlvo = Math.min(12, Math.max(6, playerCount + 5))
  for (let i = 0; snakes.length < totalAlvo; i++) {
    snakes.push(mkSnake(`ai${i}`, null, NOMES_IA[i % NOMES_IA.length]!, CORES[(playerCount + i) % CORES.length]!, true))
  }
  for (const s of snakes) nascer(s, snakes)
  const food: Food[] = []
  for (let i = 0; i < FOOD_ALVO; i++) food.push(novaFood())
  return { time: 0, snakes, food, finished: false, winnerSeats: [], draw: false }
}

function mkSnake(id: string, seat: number | null, nome: string, cor: string, ai: boolean): Snake {
  return { id, seat, nome, cor, vivo: false, boost: false, aim: 0, angle: 0, pts: [], tam: START_TAM, best: START_TAM, respawn: 0, ai, aiTimer: 0 }
}

/** amostra o corpo em anéis igualmente espaçados (cabeça primeiro) */
function amostraCorpo(pts: Ponto[], maxSegs: number): Ponto[] {
  if (!pts.length) return []
  const out: Ponto[] = [pts[0]!]
  let acc = 0
  for (let i = 1; i < pts.length && out.length < maxSegs; i++) {
    acc += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
    if (acc >= COBRA_SEG) {
      out.push(pts[i]!)
      acc = 0
    }
  }
  return out
}

function aplicaAcao(state: CobraState, seat: number, action: CobraAction): { state: CobraState } {
  const snake = state.snakes.find((s) => s.seat === seat)
  if (snake) {
    if (action.type === 'mira' && typeof action.angulo === 'number' && Number.isFinite(action.angulo)) {
      snake.aim = action.angulo
    } else if (action.type === 'boost') {
      snake.boost = !!action.on
    }
  }
  return { state }
}

/** IA simples: mira na comida mais perto, foge da borda e desvia de cobras */
function pensaIA(state: CobraState, s: Snake) {
  const cabeca = s.pts[0]!
  s.aiTimer -= 1
  // comida mais próxima num raio
  let melhor: Food | null = null
  let melhorD = 320 ** 2
  for (const f of state.food) {
    const d = dist2(cabeca, f)
    if (d < melhorD) {
      melhorD = d
      melhor = f
    }
  }
  let alvo = melhor ? Math.atan2(melhor.y - cabeca.y, melhor.x - cabeca.x) : s.aim
  if (!melhor && s.aiTimer <= 0) {
    alvo = s.angle + rand(-0.8, 0.8)
    s.aiTimer = Math.floor(rand(20, 50))
  }
  // fugir da borda
  const distCentro = Math.hypot(cabeca.x, cabeca.y)
  if (distCentro > COBRA_RAIO * 0.78) {
    alvo = Math.atan2(-cabeca.y, -cabeca.x)
  }
  // desviar de corpos próximos à frente
  const frente = { x: cabeca.x + Math.cos(s.angle) * 40, y: cabeca.y + Math.sin(s.angle) * 40 }
  for (const o of state.snakes) {
    if (o === s || !o.vivo) continue
    for (let i = 2; i < o.pts.length; i += 4) {
      if (dist2(frente, o.pts[i]!) < 34 ** 2) {
        alvo = s.angle + 1.1
        break
      }
    }
  }
  s.aim = alvo
  s.boost = s.tam > 40 && melhor !== null && melhorD < 120 ** 2 && Math.random() < 0.02
}

function mata(state: CobraState, s: Snake) {
  // corpo vira comida
  for (let i = 0; i < s.pts.length; i += 3) {
    const p = s.pts[i]!
    state.food.push({ x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), r: 7, c: s.cor, v: 3 })
  }
  s.vivo = false
  s.pts = []
  s.respawn = state.time + 2
}

function tickCobra(state: CobraState, dt: number) {
  if (state.finished) return
  state.time += dt
  const center = { x: 0, y: 0 }

  for (const s of state.snakes) {
    if (!s.vivo) {
      if (state.time >= s.respawn) nascer(s, state.snakes)
      continue
    }
    if (s.ai) pensaIA(state, s)

    // vira a cabeça em direção à mira
    const diff = norm(s.aim - s.angle)
    const maxT = TURN * dt
    s.angle += Math.max(-maxT, Math.min(maxT, diff))

    const podeBoost = s.boost && s.tam > MIN_TAM
    const speed = podeBoost ? BOOST_SPEED : BASE_SPEED
    const step = speed * dt
    const cabeca = s.pts[0]!
    const nova = { x: cabeca.x + Math.cos(s.angle) * step, y: cabeca.y + Math.sin(s.angle) * step }
    s.pts.unshift(nova)

    // gasto do boost (larga comida na cauda)
    if (podeBoost) {
      s.tam -= DRAIN * dt
      if (Math.random() < dt * 8) {
        const cauda = s.pts[s.pts.length - 1]!
        state.food.push({ x: cauda.x, y: cauda.y, r: 5, c: s.cor, v: 1 })
      }
    }

    // apara o corpo pelo comprimento-alvo
    const alvoDist = Math.max(MIN_TAM, s.tam) * COBRA_SEG
    let acc = 0
    let corte = s.pts.length
    for (let i = 1; i < s.pts.length; i++) {
      acc += Math.hypot(s.pts[i]!.x - s.pts[i - 1]!.x, s.pts[i]!.y - s.pts[i - 1]!.y)
      if (acc >= alvoDist) {
        corte = i + 1
        break
      }
    }
    if (corte < s.pts.length) s.pts.length = corte

    const raio = raioDe(s.tam)

    // come comida
    for (let i = state.food.length - 1; i >= 0; i--) {
      const f = state.food[i]!
      if (dist2(nova, f) < (raio + f.r) ** 2) {
        s.tam += f.v
        state.food.splice(i, 1)
      }
    }

    // borda circular mata
    if (Math.hypot(nova.x - center.x, nova.y - center.y) > COBRA_RAIO - raio) {
      mata(state, s)
      continue
    }

    s.best = Math.max(s.best, Math.round(s.tam))
  }

  // colisões cabeça × corpo de OUTRA cobra
  const mortas: Snake[] = []
  for (const s of state.snakes) {
    if (!s.vivo) continue
    const cabeca = s.pts[0]!
    const raio = raioDe(s.tam)
    for (const o of state.snakes) {
      if (o === s || !o.vivo) continue
      const ro = raioDe(o.tam)
      const lim = (raio + ro * 0.85) ** 2
      for (let i = 1; i < o.pts.length; i += 2) {
        if (dist2(cabeca, o.pts[i]!) < lim) {
          mortas.push(s)
          break
        }
      }
      if (mortas.includes(s)) break
    }
  }
  for (const s of mortas) mata(state, s)

  // repõe comida
  while (state.food.length < FOOD_ALVO) state.food.push(novaFood())
  if (state.food.length > FOOD_ALVO * 1.5) state.food.length = FOOD_ALVO * 1.5

  // fim por tempo
  if (state.time >= COBRA_DURACAO) {
    state.finished = true
    const humanos = state.snakes.filter((s) => s.seat !== null)
    const maxBest = Math.max(...humanos.map((s) => s.best), 0)
    const vencedores = humanos.filter((s) => s.best === maxBest)
    state.winnerSeats = vencedores.map((s) => s.seat!)
    state.draw = vencedores.length !== 1
  }
}

function snapshot(state: CobraState): CobraSnapshot {
  const snakes: CobraSnakeView[] = state.snakes.map((s) => ({
    id: s.id,
    seat: s.seat,
    nome: s.nome,
    cor: s.cor,
    vivo: s.vivo,
    boost: s.boost && s.tam > MIN_TAM,
    corpo: amostraCorpo(s.pts, VIEW_MAX),
    raio: raioDe(s.tam),
    tamanho: Math.round(s.tam),
  }))
  const food: CobraFoodView[] = state.food.map((f) => ({ x: f.x, y: f.y, r: f.r, c: f.c }))
  const placar = [...state.snakes]
    .sort((a, b) => Math.round(b.tam) - Math.round(a.tam))
    .slice(0, 6)
    .map((s) => ({ seat: s.seat, nome: s.nome, tamanho: Math.round(s.tam), vivo: s.vivo }))
  return {
    raio: COBRA_RAIO,
    tempo: state.time,
    duracao: COBRA_DURACAO,
    snakes,
    food,
    placar,
    finished: state.finished,
    winnerSeats: state.winnerSeats,
    draw: state.draw,
  }
}

export const slitherModule: GameModule<CobraState, CobraAction> = {
  slug: 'cobra-arena',
  minPlayers: 1,
  maxPlayers: 6,
  realtime: { tickMs: 45, broadcastEvery: 2 },

  init(playerCount) {
    return initialCobraState(playerCount)
  },

  play(state, seat, action) {
    if (!action || typeof (action as { type?: unknown }).type !== 'string') {
      return { error: 'Ação inválida' }
    }
    return aplicaAcao(state, seat, action)
  },

  tick(state, dt) {
    tickCobra(state, dt)
  },

  getStateFor(state) {
    return snapshot(state)
  },

  scoresFor(state) {
    // pontuação por assento = maior tamanho alcançado
    const bySeat: number[] = []
    for (const s of state.snakes) if (s.seat !== null) bySeat[s.seat] = s.best
    return bySeat
  },

  result(state) {
    return { finished: state.finished, winnerSeats: state.winnerSeats, draw: state.draw }
  },
}
