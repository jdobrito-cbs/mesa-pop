import { describe, expect, it } from 'vitest'
import {
  curveAt,
  initialCar,
  isOnRoad,
  stepCar,
  CURVE_SCALE,
  TRACK_LENGTH,
  VEHICLES,
  type CarInputState,
  type CarState,
} from '@mesapop/shared'
import {
  applyRacingInput,
  initialRacingState,
  tickRacing,
} from '../src/games/racing'

const input = (over: Partial<CarInputState> = {}): CarInputState => ({
  seq: 1,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  ...over,
})

/** piloto de teste: contra-esterça a centrífuga e volta para o centro */
function botInput(car: CarState, seq: number, vehicle: 'carro' | 'moto' = 'carro'): CarInputState {
  const spec = VEHICLES[vehicle]
  const raw = curveAt(car.dist) / CURVE_SCALE
  const sf = Math.min(car.speed / spec.maxSpeed, 1)
  const counter = (raw * spec.centrifugal * sf * sf) / spec.steer
  const steer = Math.max(-1, Math.min(1, counter - car.lat * 0.9 - car.latV * 0.35))
  return input({ seq, steer })
}

function drive(car: CarState, steps: number, vehicle: 'carro' | 'moto' = 'carro'): CarState {
  for (let i = 0; i < steps; i++) car = stepCar(car, botInput(car, i + 1, vehicle), 1 / 30, vehicle)
  return car
}

describe('física do veículo (compartilhada = determinística)', () => {
  it('acelera sozinho (arcade) e satura na velocidade máxima', () => {
    let car = initialCar(0)
    car.dist = 0 // começo do retão
    for (let i = 0; i < 90; i++) car = stepCar(car, input(), 1 / 30)
    expect(car.speed).toBeGreaterThan(240)
    expect(car.speed).toBeLessThanOrEqual(VEHICLES.carro.maxSpeed)
    expect(car.dist).toBeGreaterThan(300)
  })

  it('determinística: mesma sequência de inputs → mesmo estado', () => {
    let a = initialCar(0)
    let b = initialCar(0)
    for (let i = 0; i < 150; i++) {
      const inp = input({ steer: i % 20 < 10 ? 0.6 : -0.4, drift: i % 30 > 20 })
      a = stepCar(a, inp, 1 / 30)
      b = stepCar(b, inp, 1 / 30)
    }
    expect(a).toEqual(b)
  })

  it('derrapar deslizando CARREGA o boost', () => {
    let car = initialCar(0)
    car.dist = 0
    for (let i = 0; i < 60; i++) car = stepCar(car, input(), 1 / 30) // ganha velocidade no retão
    expect(car.boostMeter).toBe(0)
    // drift em zigue-zague (deslizamento lateral alto, sem sair da pista)
    for (let i = 0; i < 40; i++) {
      car = stepCar(car, input({ steer: i % 14 < 7 ? 1 : -1, drift: true }), 1 / 30)
    }
    expect(car.boostMeter).toBeGreaterThan(0.12)
  })

  it('boost estoura o teto de velocidade mas corta a esterçada (trade-off)', () => {
    let fast = initialCar(0)
    fast.dist = 0
    fast.boostMeter = 1
    // 40 passos ≈ 1.3s: ainda dentro da carga do boost
    for (let i = 0; i < 40; i++) fast = stepCar(fast, input({ boost: true }), 1 / 30)
    expect(fast.boosting).toBe(true)
    expect(fast.speed).toBeGreaterThan(VEHICLES.carro.maxSpeed + 30)

    // deslocamento lateral com boost é bem menor que sem
    let base = initialCar(0)
    base.dist = 0
    for (let i = 0; i < 60; i++) base = stepCar(base, input(), 1 / 30)
    base = { ...base, lat: 0, latV: 0, boostMeter: 1 }
    let plain = { ...base }
    let boosted = { ...base }
    for (let i = 0; i < 20; i++) {
      plain = stepCar(plain, input({ steer: 1 }), 1 / 30)
      boosted = stepCar(boosted, input({ steer: 1, boost: true }), 1 / 30)
    }
    expect(Math.abs(boosted.lat)).toBeLessThan(Math.abs(plain.lat) * 0.7)
  })

  it('grama freia: fora do asfalto a velocidade despenca', () => {
    let car = initialCar(0)
    car.dist = 0
    for (let i = 0; i < 90; i++) car = stepCar(car, input(), 1 / 30)
    const onRoadSpeed = car.speed
    car = { ...car, lat: 1.7, latV: 0 } // teleporta para a grama
    expect(isOnRoad(car.lat)).toBe(false)
    for (let i = 0; i < 45; i++) car = stepCar(car, input(), 1 / 30)
    expect(car.speed).toBeLessThan(onRoadSpeed * 0.6)
  })

  it('a curva empurra para fora; a moto escorrega mais que o carro', () => {
    // acha uma curva forte da pista
    let d = 0
    while (Math.abs(curveAt(d) / CURVE_SCALE) < 1.4 && d < TRACK_LENGTH) d += 20
    expect(d).toBeLessThan(TRACK_LENGTH)

    const setup = (vehicle: 'carro' | 'moto') => {
      let c = initialCar(0)
      c.dist = 0
      for (let i = 0; i < 90; i++) c = stepCar(c, input(), 1 / 30, vehicle) // velocidade
      return { ...c, dist: d + 80, lat: 0, latV: 0 }
    }
    let carro = setup('carro')
    let moto = setup('moto')
    for (let i = 0; i < 20; i++) {
      carro = stepCar(carro, input(), 1 / 30, 'carro')
      moto = stepCar(moto, input(), 1 / 30, 'moto')
    }
    expect(Math.abs(carro.lat)).toBeGreaterThan(0.05) // foi empurrado
    expect(Math.abs(moto.lat)).toBeGreaterThan(Math.abs(carro.lat)) // moto mais
  })

  it('checkpoints em ordem e volta completa', () => {
    let car = initialCar(0)
    car.dist = 0
    expect(car.nextCheckpoint).toBe(0)
    // até depois do 1º quarto da pista
    while (car.dist < TRACK_LENGTH / 4 + 40) car = drive(car, 10)
    expect(car.nextCheckpoint).toBe(1)
    // segue até fechar a volta
    let guard = 0
    while (car.lap < 1 && guard++ < 300) car = drive(car, 10)
    expect(car.lap).toBe(1)
    expect(car.nextCheckpoint).toBe(0)
  })
})

describe('estado da corrida (servidor)', () => {
  it('countdown → racing; inputs movem o carro; seq atrasado é ignorado', () => {
    const s = initialRacingState(2)
    expect(s.phase).toBe('countdown')
    expect(s.vehicle).toBe('carro')
    for (let i = 0; i < 120; i++) tickRacing(s, 1 / 30)
    expect(s.phase).toBe('racing')

    applyRacingInput(s, 0, { seq: 5, steer: 0.5 })
    expect(s.inputs[0]!.steer).toBe(0.5)
    applyRacingInput(s, 0, { seq: 3, steer: -1 }) // atrasado
    expect(s.inputs[0]!.steer).toBe(0.5)
    expect(s.lastAck[0]).toBe(5)

    const d0 = s.cars[0]!.dist
    for (let i = 0; i < 60; i++) tickRacing(s, 1 / 30)
    expect(s.cars[0]!.dist).toBeGreaterThan(d0)
  })

  it('opção da sala escolhe a moto (validada)', () => {
    expect(initialRacingState(2, { vehicle: 'moto' }).vehicle).toBe('moto')
    expect(initialRacingState(2, { vehicle: 'jato' }).vehicle).toBe('carro')
  })

  it('corrida termina com ordem de chegada (1 volta p/ teste)', () => {
    const s = initialRacingState(2)
    s.totalLaps = 1
    tickRacing(s, 4) // queima o countdown → racing (sem estreitar o tipo)
    for (let step = 0; step < 6000 && s.phase !== 'finished'; step++) {
      applyRacingInput(s, 0, botInput(s.cars[0]!, step + 1))
      tickRacing(s, 1 / 30)
      if (s.closeTimer !== null) s.closeTimer = 0 // fecha logo após o 1º
    }
    expect(s.phase).toBe('finished')
    expect(s.finishOrder[0]).toBe(0)
    expect(s.cars[0]!.finished).toBe(true)
    expect(s.finishOrder).toHaveLength(2)
  })
})
