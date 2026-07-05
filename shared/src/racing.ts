/**
 * Corrida Pop — física e pista COMPARTILHADAS entre servidor e cliente.
 * O servidor é autoritativo; o cliente roda a MESMA física para prever o
 * próprio veículo (client-side prediction) e reconcilia quando o snapshot
 * chega. Por isso este módulo precisa ser determinístico e puro.
 *
 * MODELO (terceira pessoa, estilo Top Gear): o veículo vive em coordenadas
 * DA PISTA — `dist` (distância percorrida ao longo do traçado) e `lat`
 * (deslocamento lateral, -1..1 dentro do asfalto). A pista é uma sequência
 * de segmentos com curva e inclinação; a curva empurra o veículo para fora
 * (força centrífuga) e o volante o traz de volta.
 *
 * O loop de habilidade da visão:
 * - DRIFT reduz o grip lateral → o veículo desliza; deslizar em velocidade
 *   CARREGA O BOOST.
 * - BOOST dá velocidade extra mas REDUZ a esterçada — arriscar na curva é
 *   caótico, usar na reta é seguro.
 */

export const RACE_W = 960
export const RACE_H = 560

export type VehicleKind = 'carro' | 'moto'

export interface VehicleSpec {
  accel: number
  brake: number
  maxSpeed: number
  boostMaxSpeed: number
  boostAccel: number
  /** força do volante (unidades de lat/s²) */
  steer: number
  /** amortecimento do deslizamento lateral */
  grip: number
  driftGrip: number
  /** quanto a curva empurra para fora */
  centrifugal: number
}

/** moto = mais rápida e mais escorregadia (menos grip, mais centrífuga) */
export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  carro: {
    accel: 165, brake: 380, maxSpeed: 280, boostMaxSpeed: 400, boostAccel: 330,
    steer: 10, grip: 6, driftGrip: 1.5, centrifugal: 5.5,
  },
  moto: {
    accel: 190, brake: 340, maxSpeed: 300, boostMaxSpeed: 430, boostAccel: 370,
    steer: 11.5, grip: 4.4, driftGrip: 1.05, centrifugal: 6.6,
  },
}

export interface CarState {
  /** distância TOTAL percorrida ao longo da pista (não zera por volta) */
  dist: number
  /** deslocamento lateral: -1..1 = asfalto, além = zebra/grama */
  lat: number
  /** velocidade lateral (deslizamento) */
  latV: number
  /** velocidade para frente */
  speed: number
  /** 0..1 */
  boostMeter: number
  boosting: boolean
  drifting: boolean
  lap: number
  /** próximo checkpoint esperado (0..CHECKPOINT_COUNT-1) */
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
  /** freio */
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
  vehicle: VehicleKind
  cars: CarState[]
  lastAck: number[]
  finishOrder: number[]
}

/* ---------------- pista ---------------- */

export interface TrackSegment {
  length: number
  /** >0 curva à direita, <0 à esquerda */
  curve: number
  /** inclinação (sobe/desce) */
  hill: number
  /** distância acumulada até o INÍCIO do segmento */
  start: number
  /** elevação acumulada no início do segmento */
  elev: number
}

/** converte curva·comprimento em mudança de rumo (p/ o traçado fechar) */
export const CURVE_K = 620

const RAW: Array<{ length: number; curve: number; hill: number }> = [
  { length: 640, curve: 0, hill: 0 },      // retão de largada
  { length: 420, curve: 1.3, hill: 0 },    // direita larga
  { length: 260, curve: 0, hill: 0.9 },    // subida reta
  { length: 340, curve: 1.7, hill: 0 },    // direita fechada na crista
  { length: 260, curve: 0, hill: -0.9 },   // descida
  { length: 300, curve: -1.5, hill: 0 },   // esquerda média
  { length: 200, curve: 0, hill: 0 },
  { length: 220, curve: -1.8, hill: 0 },   // CHICANE: esquerda seca…
  { length: 220, curve: 1.8, hill: 0 },    // …direita seca
  { length: 320, curve: 0, hill: 0.7 },    // sobe de novo
  { length: 380, curve: 1.6, hill: 0 },    // direita longa
  { length: 320, curve: 0, hill: -0.7 },   // desce até…
  { length: 420, curve: 1.5, hill: 0 },    // …o cotovelo final
  { length: 500, curve: 0, hill: 0 },      // reta do fundo
]

// normaliza as curvas para o traçado fechar EXATO em 360° (minimapa fiel)
const rawTurn = RAW.reduce((sum, s) => sum + s.curve * s.length, 0)
export const CURVE_SCALE = (Math.PI * 2 * CURVE_K) / rawTurn

export const TRACK_SEGMENTS: TrackSegment[] = (() => {
  const out: TrackSegment[] = []
  let start = 0
  let elev = 0
  for (const s of RAW) {
    out.push({ length: s.length, curve: s.curve * CURVE_SCALE, hill: s.hill, start, elev })
    start += s.length
    elev += s.hill * s.length
  }
  return out
})()

export const TRACK_LENGTH = TRACK_SEGMENTS.reduce((sum, s) => sum + s.length, 0)

/** distância dentro da volta (aceita dist negativa do grid de largada) */
export function lapDistance(dist: number): number {
  return ((dist % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH
}

export function segmentAt(dist: number): TrackSegment {
  const d = lapDistance(dist)
  for (let i = TRACK_SEGMENTS.length - 1; i >= 0; i--) {
    if (d >= TRACK_SEGMENTS[i]!.start) return TRACK_SEGMENTS[i]!
  }
  return TRACK_SEGMENTS[0]!
}

/** curva na posição, com transição suave na entrada do segmento */
export function curveAt(dist: number): number {
  const d = lapDistance(dist)
  const seg = segmentAt(d)
  const local = d - seg.start
  const BLEND = 70
  if (local < BLEND) {
    const prev = segmentAt(d - local - 1)
    const t = local / BLEND
    return prev.curve + (seg.curve - prev.curve) * t
  }
  return seg.curve
}

/** elevação acumulada na posição (p/ morros no render) */
export function elevationAt(dist: number): number {
  const d = lapDistance(dist)
  const seg = segmentAt(d)
  return seg.elev + seg.hill * (d - seg.start)
}

/** traçado 2D (p/ minimapa): integra o rumo ao longo da pista */
export function trackLayout(step = 40): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  let x = 0
  let y = 0
  let heading = 0
  for (let d = 0; d < TRACK_LENGTH; d += step) {
    pts.push([x, y])
    heading += (curveAt(d) / CURVE_K) * step
    x += Math.cos(heading) * step
    y += Math.sin(heading) * step
  }
  return pts
}

export const CHECKPOINT_COUNT = 4
export const ROAD_LIMIT = 1.15 // além disso é grama
const LAT_MAX = 2.4
const LATV_MAX = 3.2
const SLIDE_DRAG = 0.05
const GRASS_DRAG = 2.2
const DRIFT_STEER_BONUS = 1.35
const BOOST_STEER_CUT = 0.45
const BOOST_DRAIN = 0.55
const BOOST_CHARGE = 0.55
const DRIFT_CHARGE_MIN_SLIDE = 1.1

/** grid de largada 2×2 atrás da linha */
export function startPose(seat: number): { dist: number; lat: number } {
  return {
    dist: -46 - Math.floor(seat / 2) * 60,
    lat: (seat % 2 === 0 ? -1 : 1) * 0.45,
  }
}

export function initialCar(seat: number): CarState {
  const pose = startPose(seat)
  return {
    dist: pose.dist,
    lat: pose.lat,
    latV: 0,
    speed: 0,
    boostMeter: 0,
    boosting: false,
    drifting: false,
    lap: 0,
    nextCheckpoint: 0,
    finished: false,
    finishTime: null,
  }
}

export function isOnRoad(lat: number): boolean {
  return Math.abs(lat) <= ROAD_LIMIT
}

/**
 * Um passo da física (retorna cópia). Determinística: mesma entrada,
 * mesmo resultado — requisito para prediction/reconciliação.
 */
export function stepCar(
  car: CarState,
  input: CarInputState,
  dt: number,
  vehicle: VehicleKind = 'carro',
): CarState {
  const c = { ...car }
  const spec = VEHICLES[vehicle]

  if (c.finished) {
    c.speed = Math.max(c.speed - spec.brake * 0.6 * dt, 0)
    c.latV *= Math.max(1 - spec.grip * dt, 0)
    c.lat += c.latV * dt
    c.dist += c.speed * dt
    return c
  }

  const onRoad = isOnRoad(c.lat)
  const speedFactor = Math.min(c.speed / spec.maxSpeed, 1)

  // boost: consome se pedido e houver carga
  const wantBoost = input.boost && c.boostMeter > 0.15
  c.boosting = wantBoost
  if (c.boosting) c.boostMeter = Math.max(0, c.boostMeter - BOOST_DRAIN * dt)

  // drift: só faz sentido em velocidade
  c.drifting = input.drift && c.speed > 100

  // volante — com boost vira BEM menos (o trade-off da visão)
  let steerForce = spec.steer
  if (c.drifting) steerForce *= DRIFT_STEER_BONUS
  if (c.boosting) steerForce *= BOOST_STEER_CUT
  c.latV += input.steer * steerForce * speedFactor * dt

  // força centrífuga: a curva empurra para FORA (curva à direita → esquerda)
  const rawCurve = curveAt(c.dist) / CURVE_SCALE
  c.latV -= rawCurve * spec.centrifugal * speedFactor * speedFactor * dt

  // grip mata o deslizamento; no drift quase não mata (desliza)
  const grip = c.drifting ? spec.driftGrip : spec.grip
  c.latV *= Math.max(1 - grip * dt, 0)
  c.latV = Math.max(-LATV_MAX, Math.min(LATV_MAX, c.latV))

  // deslizar de verdade no drift carrega o boost
  if (c.drifting && Math.abs(c.latV) > DRIFT_CHARGE_MIN_SLIDE) {
    c.boostMeter = Math.min(1, c.boostMeter + BOOST_CHARGE * dt)
  }

  c.lat = Math.max(-LAT_MAX, Math.min(LAT_MAX, c.lat + c.latV * dt))

  // aceleração automática (arcade) / freio
  if (input.brake) {
    c.speed = Math.max(c.speed - spec.brake * dt, 0)
  } else {
    c.speed += (c.boosting ? spec.boostAccel : spec.accel) * dt
  }

  // deslizamento gasta velocidade (o custo do drift)
  c.speed *= Math.max(1 - Math.abs(c.latV) * SLIDE_DRAG * dt, 0)

  // grama freia forte e limita o teto
  let maxSpeed = c.boosting ? spec.boostMaxSpeed : spec.maxSpeed
  if (!onRoad) {
    c.speed *= Math.max(1 - GRASS_DRAG * dt, 0)
    maxSpeed *= 0.5
  }
  c.speed = Math.min(c.speed, maxSpeed)

  c.dist += c.speed * dt

  // checkpoints em ordem (anti-corte) e voltas
  const target = c.lap * TRACK_LENGTH + ((c.nextCheckpoint + 1) * TRACK_LENGTH) / CHECKPOINT_COUNT
  if (c.dist >= target) {
    c.nextCheckpoint++
    if (c.nextCheckpoint >= CHECKPOINT_COUNT) {
      c.nextCheckpoint = 0
      c.lap++
    }
  }
  return c
}

/** progresso total para ranking ao vivo: a própria distância percorrida */
export function raceProgress(car: CarState): number {
  return car.dist
}
