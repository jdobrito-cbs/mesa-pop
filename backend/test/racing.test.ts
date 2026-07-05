import { describe, expect, it } from 'vitest'
import {
  initialCar,
  isOnRoad,
  stepCar,
  startPose,
  TRACK,
  type CarInputState,
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

const speedOf = (c: { vx: number; vy: number }) => Math.hypot(c.vx, c.vy)

/** carro parado no começo da reta principal, apontando ao longo dela */
function carOnStraight() {
  const car = initialCar(0)
  car.x = 190
  car.y = 109
  car.angle = Math.atan2(90 - 110, 420 - 180)
  return car
}

describe('física do carro (compartilhada = determinística)', () => {
  it('acelera sozinho (arcade) e satura na velocidade máxima', () => {
    let car = carOnStraight()
    for (let i = 0; i < 85; i++) car = stepCar(car, input(), 1 / 60)
    expect(speedOf(car)).toBeGreaterThan(230)
    expect(speedOf(car)).toBeLessThanOrEqual(266)
  })

  it('determinística: mesma sequência de inputs → mesmo estado', () => {
    let a = initialCar(0)
    let b = initialCar(0)
    for (let i = 0; i < 120; i++) {
      const inp = input({ steer: i % 20 < 10 ? 0.6 : -0.4, drift: i % 30 > 20 })
      a = stepCar(a, inp, 1 / 60)
      b = stepCar(b, inp, 1 / 60)
    }
    expect(a).toEqual(b)
  })

  it('derrapar em curva CARREGA o boost', () => {
    let car = carOnStraight()
    for (let i = 0; i < 60; i++) car = stepCar(car, input(), 1 / 60) // ganha velocidade
    const before = car.boostMeter
    for (let i = 0; i < 60; i++) {
      car = stepCar(car, input({ steer: 1, drift: true }), 1 / 60)
    }
    expect(car.boostMeter).toBeGreaterThan(before + 0.15)
  })

  it('boost aumenta a velocidade máxima mas o carro vira menos (trade-off)', () => {
    // velocidade com boost supera o cap normal (265)
    let fast = carOnStraight()
    fast.boostMeter = 1
    for (let i = 0; i < 60; i++) fast = stepCar(fast, input({ boost: true }), 1 / 60)
    expect(speedOf(fast)).toBeGreaterThan(300)

    // giro acumulado com boost é menor que sem boost
    let normal = carOnStraight()
    for (let i = 0; i < 45; i++) normal = stepCar(normal, input(), 1 / 60)
    let boosted = { ...normal, boostMeter: 1 }
    let plain = { ...normal }
    const angle0 = normal.angle
    for (let i = 0; i < 45; i++) {
      plain = stepCar(plain, input({ steer: 1 }), 1 / 60)
      boosted = stepCar(boosted, input({ steer: 1, boost: true }), 1 / 60)
    }
    expect(Math.abs(boosted.angle - angle0)).toBeLessThan(Math.abs(plain.angle - angle0) * 0.8)
  })

  it('grama desacelera: fora da pista a velocidade cai', () => {
    let car = carOnStraight()
    for (let i = 0; i < 60; i++) car = stepCar(car, input(), 1 / 60)
    const onRoadSpeed = speedOf(car)
    // teleporta para o gramado (miolo do mapa, longe da pista)
    car = { ...car, x: 460, y: 240, angle: 0 }
    expect(isOnRoad(car.x, car.y)).toBe(false)
    for (let i = 0; i < 60; i++) car = stepCar(car, input(), 1 / 60)
    expect(speedOf(car)).toBeLessThan(onRoadSpeed * 0.75)
  })
})

describe('estado da corrida (servidor)', () => {
  it('countdown → racing; inputs movem o carro; seq atrasado é ignorado', () => {
    const s = initialRacingState(2)
    expect(s.phase).toBe('countdown')
    for (let i = 0; i < 120; i++) tickRacing(s, 1 / 30)
    expect(s.phase).toBe('racing')

    applyRacingInput(s, 0, { seq: 5, steer: 0.5 })
    expect(s.inputs[0]!.steer).toBe(0.5)
    applyRacingInput(s, 0, { seq: 3, steer: -1 }) // atrasado
    expect(s.inputs[0]!.steer).toBe(0.5)
    expect(s.lastAck[0]).toBe(5)

    const x0 = s.cars[0]!.x
    for (let i = 0; i < 60; i++) tickRacing(s, 1 / 30)
    expect(s.cars[0]!.x).not.toBe(x0)
  })

  it('corrida termina com ordem de chegada (voltas via env p/ teste)', () => {
    const s = initialRacingState(2)
    s.phase = 'racing'
    s.totalLaps = 1
    // carro 0 dirige "no trilho": mira o próximo waypoint da pista
    for (let step = 0; step < 4000 && s.phase !== 'finished'; step++) {
      const car = s.cars[0]!
      // alvo: waypoint seguinte ao segmento atual
      let bestIdx = 0
      let bestD = Infinity
      TRACK.forEach(([wx, wy], i) => {
        const d = (wx - car.x) ** 2 + (wy - car.y) ** 2
        if (d < bestD) {
          bestD = d
          bestIdx = i
        }
      })
      const [tx, ty] = TRACK[(bestIdx + 1) % TRACK.length]!
      const want = Math.atan2(ty - car.y, tx - car.x)
      let diff = want - car.angle
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      applyRacingInput(s, 0, { seq: step + 1, steer: Math.max(-1, Math.min(1, diff * 2.2)) })
      tickRacing(s, 1 / 30)
      if (s.closeTimer !== null) s.closeTimer = 0 // fecha logo após o 1º
    }
    expect(s.phase).toBe('finished')
    expect(s.finishOrder[0]).toBe(0)
    expect(s.cars[0]!.finished).toBe(true)
    expect(s.finishOrder).toHaveLength(2)
  })
})
