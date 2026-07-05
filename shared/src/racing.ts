/**
 * Corrida Pop — física e pista COMPARTILHADAS entre servidor e cliente.
 * O servidor é autoritativo; o cliente roda a MESMA física para prever o
 * próprio carro (client-side prediction) e reconcilia quando o snapshot
 * chega. Por isso este módulo precisa ser determinístico e puro.
 *
 * O loop de habilidade da visão:
 * - DRIFT (derrapar) reduz o grip lateral → o carro desliza; derrapar em
 *   velocidade CARREGA O BOOST.
 * - BOOST dá velocidade extra mas REDUZ o controle (vira menos) — arriscar
 *   na curva é caótico, usar na reta é seguro.
 */

export const RACE_W = 960
export const RACE_H = 620

export interface CarState {
  x: number
  y: number
  /** direção do nariz (rad) */
  angle: number
  vx: number
  vy: number
  /** 0..1 */
  boostMeter: number
  boosting: boolean
  drifting: boolean
  lap: number
  /** próximo checkpoint esperado (índice em CHECKPOINTS) */
  nextCheckpoint: number
  finished: boolean
  /** tempo de corrida ao terminar (s) */
  finishTime: number | null
}

export interface CarInputState {
  /** sequência crescente do cliente (para reconciliação) */
  seq: number
  /** -1 esquerda .. 1 direita */
  steer: number
  /** freio/ré */
  brake: boolean
  drift: boolean
  boost: boolean
}

export const TOTAL_LAPS = 3

/** snapshot transmitido pelo servidor (inclui lastAck p/ reconciliação) */
export interface RacingSnapshot {
  phase: 'countdown' | 'racing' | 'finished'
  countdown: number
  raceTime: number
  totalLaps: number
  cars: CarState[]
  lastAck: number[]
  finishOrder: number[]
}

/* ---------------- pista ---------------- */

/** linha central da pista (loop fechado), sentido horário */
export const TRACK: Array<[number, number]> = [
  [180, 110], [420, 90], [660, 100], [820, 150], [870, 280],
  [830, 400], [700, 460], [620, 400], [540, 330], [440, 330],
  [380, 420], [300, 520], [180, 530], [90, 450], [80, 300], [100, 170],
]

export const ROAD_HALF_WIDTH = 46

/** checkpoints = índices de waypoints que precisam ser cruzados em ordem */
export const CHECKPOINTS = [0, 4, 8, 12]

/** posição/direção de largada do assento (grid 2×2 atrás da linha) */
export function startPose(seat: number): { x: number; y: number; angle: number } {
  const [ax, ay] = TRACK[0]!
  const [bx, by] = TRACK[1]!
  const dir = Math.atan2(by - ay, bx - ax)
  const back = -34 - Math.floor(seat / 2) * 40
  const side = (seat % 2 === 0 ? -1 : 1) * 18
  return {
    x: ax + Math.cos(dir) * back + Math.cos(dir + Math.PI / 2) * side,
    y: ay + Math.sin(dir) * back + Math.sin(dir + Math.PI / 2) * side,
    angle: dir,
  }
}

/** distância do ponto ao segmento + parâmetro t */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + dx * t
  const cy = ay + dy * t
  return { dist: Math.hypot(px - cx, py - cy), t, cx, cy }
}

/** segmento mais próximo da pista + distância à linha central */
export function nearestOnTrack(x: number, y: number): { dist: number; seg: number; t: number } {
  let best = { dist: Infinity, seg: 0, t: 0 }
  for (let i = 0; i < TRACK.length; i++) {
    const [ax, ay] = TRACK[i]!
    const [bx, by] = TRACK[(i + 1) % TRACK.length]!
    const r = segDist(x, y, ax, ay, bx, by)
    if (r.dist < best.dist) best = { dist: r.dist, seg: i, t: r.t }
  }
  return best
}

export function isOnRoad(x: number, y: number): boolean {
  return nearestOnTrack(x, y).dist <= ROAD_HALF_WIDTH
}

/** progresso contínuo ao longo do loop (para ranking ao vivo) */
export function trackProgress(x: number, y: number): number {
  const n = nearestOnTrack(x, y)
  return (n.seg + n.t) / TRACK.length
}

/* ---------------- física ---------------- */

const ACCEL = 240
const BRAKE = 420
const MAX_SPEED = 265
const BOOST_MAX_SPEED = 390
const BOOST_ACCEL = 480
const TURN_RATE = 3.1
const BOOST_TURN_RATE = 1.5 // trade-off: no boost o carro vira MUITO menos
const GRIP = 7.5
const DRIFT_GRIP = 1.6
const GRASS_DRAG = 2.4
const DRAG = 0.35
const BOOST_DRAIN = 0.55 // por segundo
const BOOST_CHARGE = 0.5 // por segundo derrapando de verdade

export function initialCar(seat: number): CarState {
  const pose = startPose(seat)
  return {
    x: pose.x,
    y: pose.y,
    angle: pose.angle,
    vx: 0,
    vy: 0,
    boostMeter: 0,
    boosting: false,
    drifting: false,
    lap: 0,
    nextCheckpoint: 0,
    finished: false,
    finishTime: null,
  }
}

/**
 * Um passo da física (mutação em cópia). Determinística: mesma entrada,
 * mesmo resultado — requisito para prediction/reconciliação.
 */
export function stepCar(car: CarState, input: CarInputState, dt: number): CarState {
  const c = { ...car }
  if (c.finished) {
    // carro finalizado desacelera sozinho
    c.vx *= Math.max(1 - 2 * dt, 0)
    c.vy *= Math.max(1 - 2 * dt, 0)
    c.x += c.vx * dt
    c.y += c.vy * dt
    return c
  }

  const speed = Math.hypot(c.vx, c.vy)
  const onRoad = isOnRoad(c.x, c.y)

  // boost: consome se pedido e houver carga
  const wantBoost = input.boost && c.boostMeter > 0.15
  c.boosting = wantBoost
  if (c.boosting) c.boostMeter = Math.max(0, c.boostMeter - BOOST_DRAIN * dt)

  // direção — com boost o carro vira bem menos (o trade-off)
  const turnRate = c.boosting ? BOOST_TURN_RATE : TURN_RATE
  const speedFactor = Math.min(speed / 120, 1)
  c.angle += input.steer * turnRate * speedFactor * dt

  // aceleração automática (arcade) / freio
  const accel = c.boosting ? BOOST_ACCEL : ACCEL
  if (input.brake) {
    c.vx -= Math.cos(c.angle) * BRAKE * dt
    c.vy -= Math.sin(c.angle) * BRAKE * dt
  } else {
    c.vx += Math.cos(c.angle) * accel * dt
    c.vy += Math.sin(c.angle) * accel * dt
  }

  // grip lateral: decompõe a velocidade em forward/lateral e mata o lateral
  const fx = Math.cos(c.angle)
  const fy = Math.sin(c.angle)
  const forward = c.vx * fx + c.vy * fy
  const lx = -fy
  const ly = fx
  let lateral = c.vx * lx + c.vy * ly

  c.drifting = input.drift && speed > 90
  let grip = c.drifting ? DRIFT_GRIP : GRIP
  if (!onRoad) grip = Math.min(grip, 3)
  lateral *= Math.max(1 - grip * dt, 0)

  // derrapando de verdade (deslizamento lateral alto) carrega o boost
  if (c.drifting && Math.abs(lateral) > 40) {
    c.boostMeter = Math.min(1, c.boostMeter + BOOST_CHARGE * dt)
  }

  let newForward = forward * Math.max(1 - DRAG * dt, 0)
  if (!onRoad) newForward *= Math.max(1 - GRASS_DRAG * dt, 0)

  const maxSpeed = (c.boosting ? BOOST_MAX_SPEED : MAX_SPEED) * (onRoad ? 1 : 0.55)
  newForward = Math.max(Math.min(newForward, maxSpeed), -90)

  c.vx = fx * newForward + lx * lateral
  c.vy = fy * newForward + ly * lateral
  c.x += c.vx * dt
  c.y += c.vy * dt

  // limites do mundo
  c.x = Math.max(8, Math.min(RACE_W - 8, c.x))
  c.y = Math.max(8, Math.min(RACE_H - 8, c.y))

  // checkpoints e voltas
  const near = nearestOnTrack(c.x, c.y)
  const target = CHECKPOINTS[c.nextCheckpoint]!
  if (near.dist <= ROAD_HALF_WIDTH + 20 && near.seg === target) {
    c.nextCheckpoint++
    if (c.nextCheckpoint >= CHECKPOINTS.length) {
      c.nextCheckpoint = 0
      c.lap++
    }
  }
  return c
}

/** progresso total para ranking: voltas + checkpoints + fração do loop */
export function raceProgress(car: CarState): number {
  const frac = trackProgress(car.x, car.y)
  // evita "voltar" no ranking ao cruzar o 0 do loop
  const cpFrac = CHECKPOINTS[car.nextCheckpoint]! / TRACK.length
  const local = car.nextCheckpoint === 0 && frac > 0.5 ? frac - 1 : Math.min(frac, cpFrac + 0.25)
  return car.lap * 10 + car.nextCheckpoint + local
}
