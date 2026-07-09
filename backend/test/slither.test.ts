import { describe, expect, it } from 'vitest'
import { COBRA_DURACAO, COBRA_RAIO, type CobraSnapshot } from '@mesapop/shared'
import { initialCobraState, slitherModule } from '../src/games/slither'

describe('Cobra Arena (slither)', () => {
  it('a arena nasce povoada (humano + IA) e com comida', () => {
    const st = initialCobraState(1)
    expect(st.snakes.length).toBeGreaterThanOrEqual(6)
    expect(st.snakes.filter((s) => s.seat === 0).length).toBe(1)
    expect(st.snakes.filter((s) => s.seat === null).length).toBeGreaterThan(0)
    expect(st.snakes.every((s) => s.vivo)).toBe(true)
    expect(st.food.length).toBeGreaterThan(100)
  })

  it('mira e boost do jogador aplicam; o tick move a cabeça', () => {
    const st = initialCobraState(1)
    const s0 = st.snakes.find((s) => s.seat === 0)!
    s0.angle = 0 // já apontando +x (a virada é gradual)
    slitherModule.play(st, 0, { type: 'mira', angulo: 0 })
    slitherModule.play(st, 0, { type: 'boost', on: true })
    expect(s0.aim).toBe(0)
    expect(s0.boost).toBe(true)
    const hx = s0.pts[0]!.x
    slitherModule.tick!(st, 0.12)
    expect(s0.pts[0]!.x).toBeGreaterThan(hx) // andou para +x (mira 0)
  })

  it('comer comida faz crescer', () => {
    const st = initialCobraState(1)
    const s0 = st.snakes.find((s) => s.seat === 0)!
    s0.angle = 0
    s0.aim = 0
    s0.boost = false
    const antes = s0.tam
    const head = s0.pts[0]!
    st.food = [{ x: head.x + 7, y: head.y, r: 5, c: '#fff', v: 5 }]
    slitherModule.tick!(st, 0.05)
    expect(s0.tam).toBeGreaterThan(antes)
  })

  it('bater na borda mata (e agenda renascimento)', () => {
    const st = initialCobraState(1)
    const s0 = st.snakes.find((s) => s.seat === 0)!
    s0.pts = [
      { x: COBRA_RAIO + 10, y: 0 },
      { x: COBRA_RAIO + 2, y: 0 },
    ]
    s0.angle = 0
    s0.aim = 0
    s0.boost = false
    slitherModule.tick!(st, 0.05)
    expect(s0.vivo).toBe(false)
    expect(s0.respawn).toBeGreaterThan(0)
  })

  it('snapshot tem arena, cobras, comida e placar (sem vazar internals)', () => {
    const st = initialCobraState(2)
    const snap = slitherModule.getStateFor!(st, -1) as CobraSnapshot
    expect(snap.raio).toBe(COBRA_RAIO)
    expect(snap.snakes.length).toBeGreaterThanOrEqual(6)
    expect(snap.snakes[0]!.corpo.length).toBeGreaterThan(0)
    expect(snap.food.length).toBeGreaterThan(0)
    expect(snap.placar.length).toBeGreaterThan(0)
  })

  it('termina no tempo e reporta vencedor por assento', () => {
    const st = initialCobraState(2)
    st.snakes.find((s) => s.seat === 0)!.best = 50
    st.snakes.find((s) => s.seat === 1)!.best = 30
    st.time = COBRA_DURACAO - 0.01
    slitherModule.tick!(st, 0.1)
    const r = slitherModule.result(st)
    expect(r.finished).toBe(true)
    expect(r.winnerSeats).toEqual([0])
    const scores = slitherModule.scoresFor!(st)
    expect(scores[0]).toBeGreaterThanOrEqual(50)
  })
})
