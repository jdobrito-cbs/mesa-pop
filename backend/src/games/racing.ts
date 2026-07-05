/**
 * Corrida Pop — servidor AUTORITATIVO do PvP em tempo real.
 * Recebe o estado de input de cada veículo (com seq crescente), roda a
 * física compartilhada a cada tick e devolve snapshots com o último seq
 * processado por veículo — o que o cliente usa para reconciliar a previsão.
 */
import {
  initialCar,
  raceProgress,
  stepCar,
  TOTAL_LAPS,
  VEHICLES,
  type CarInputState,
  type CarState,
  type RacingSnapshot,
  type VehicleKind,
} from '@mesapop/shared'
import type { GameModule } from './module'

export interface RacingState {
  phase: 'countdown' | 'racing' | 'finished'
  countdown: number
  raceTime: number
  players: number
  vehicle: VehicleKind
  cars: CarState[]
  inputs: CarInputState[]
  lastAck: number[]
  /** ordem de chegada (assentos) */
  finishOrder: number[]
  /** encerra a corrida N s depois do primeiro terminar */
  closeTimer: number | null
  totalLaps: number
}

const NEUTRAL: CarInputState = { seq: 0, steer: 0, brake: false, drift: false, boost: false }

export function initialRacingState(players: number, options?: Record<string, unknown>): RacingState {
  const vehicle: VehicleKind = options?.vehicle === 'moto' ? 'moto' : 'carro'
  return {
    phase: 'countdown',
    countdown: 3.5,
    raceTime: 0,
    players,
    vehicle,
    cars: Array.from({ length: players }, (_, seat) => initialCar(seat)),
    inputs: Array.from({ length: players }, () => ({ ...NEUTRAL })),
    lastAck: Array.from({ length: players }, () => 0),
    finishOrder: [],
    closeTimer: null,
    totalLaps: Number(process.env.RACE_LAPS ?? TOTAL_LAPS),
  }
}

export function applyRacingInput(
  state: RacingState,
  seat: number,
  input: Partial<CarInputState>,
): { error: string } | { state: RacingState } {
  const current = state.inputs[seat]
  if (!current) return { error: 'Veículo inválido' }
  const seq = Number(input.seq ?? 0)
  if (!Number.isFinite(seq) || seq < current.seq) return { state } // pacote atrasado: ignora
  state.inputs[seat] = {
    seq,
    steer: Math.max(-1, Math.min(1, Number(input.steer ?? 0))),
    brake: Boolean(input.brake),
    drift: Boolean(input.drift),
    boost: Boolean(input.boost),
  }
  state.lastAck[seat] = seq
  return { state }
}

export function tickRacing(state: RacingState, dt: number) {
  if (state.phase === 'finished') return

  if (state.phase === 'countdown') {
    state.countdown -= dt
    if (state.countdown <= 0) {
      state.phase = 'racing'
      state.countdown = 0
    }
    return
  }

  state.raceTime += dt
  for (let seat = 0; seat < state.cars.length; seat++) {
    const before = state.cars[seat]!
    const after = stepCar(before, state.inputs[seat]!, dt, state.vehicle)
    // completou as voltas?
    if (!before.finished && after.lap >= state.totalLaps) {
      after.finished = true
      after.finishTime = state.raceTime
      state.finishOrder.push(seat)
      if (state.closeTimer === null) state.closeTimer = 20
    }
    state.cars[seat] = after
  }

  if (state.closeTimer !== null) {
    state.closeTimer -= dt
  }
  const allDone = state.cars.every((c) => c.finished)
  if (allDone || (state.closeTimer !== null && state.closeTimer <= 0)) {
    // quem não terminou entra na ordem pelo progresso atual
    const rest = state.cars
      .map((c, seat) => ({ seat, done: c.finished, prog: raceProgress(c) }))
      .filter((r) => !r.done)
      .sort((a, b) => b.prog - a.prog)
      .map((r) => r.seat)
    state.finishOrder.push(...rest)
    state.phase = 'finished'
  }
}

export function racingSnapshot(state: RacingState): RacingSnapshot {
  return {
    phase: state.phase,
    countdown: state.countdown,
    raceTime: state.raceTime,
    totalLaps: state.totalLaps,
    vehicle: state.vehicle,
    cars: state.cars,
    lastAck: state.lastAck,
    finishOrder: state.finishOrder,
  }
}

export const racingModule: GameModule<RacingState, { type: 'input' } & Partial<CarInputState>> = {
  slug: 'corrida',
  minPlayers: 2,
  maxPlayers: 4,
  realtime: { tickMs: 33, broadcastEvery: 2 },

  init(playerCount, options) {
    if (options?.vehicle !== undefined && !(String(options.vehicle) in VEHICLES)) {
      delete options.vehicle
    }
    return initialRacingState(playerCount, options)
  },

  play(state, seat, action) {
    if (!action || action.type !== 'input') return { error: 'Ação inválida' }
    return applyRacingInput(state, seat, action)
  },

  tick(state, dt) {
    tickRacing(state, dt)
  },

  getStateFor(state) {
    return racingSnapshot(state)
  },

  scoresFor(state) {
    // pontuação = posição invertida (1º ganha mais)
    const scores = Array.from({ length: state.players }, () => 0)
    state.finishOrder.forEach((seat, i) => {
      scores[seat] = Math.max(state.players - i, 1) * 100
    })
    return scores
  },

  result(state) {
    return {
      finished: state.phase === 'finished',
      winnerSeats: state.finishOrder.length ? [state.finishOrder[0]!] : [],
      draw: false,
    }
  },
}
