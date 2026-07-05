import { describe, expect, it } from 'vitest'
import {
  isSequencia,
  isTrinca,
  melhorBatida,
  particiona9,
  type PifeCard,
} from '@mesapop/shared'
import { aplicaPifeAction, initialPifeState, pifeViewFor, type PifeState } from '../src/games/pife'

const C = (r: number, s: PifeCard['s']): PifeCard => ({ r, s })

describe('Pife — jogos (trincas e sequências)', () => {
  it('trinca = 3 do mesmo valor; sequência = 3 seguidas do MESMO naipe', () => {
    expect(isTrinca([C(7, 'o'), C(7, 'c'), C(7, 'p')])).toBe(true)
    expect(isTrinca([C(7, 'o'), C(7, 'c'), C(8, 'p')])).toBe(false)
    expect(isSequencia([C(4, 'c'), C(5, 'c'), C(6, 'c')])).toBe(true)
    expect(isSequencia([C(4, 'c'), C(5, 'o'), C(6, 'c')])).toBe(false) // naipes misturados
    expect(isSequencia([C(1, 'e'), C(2, 'e'), C(3, 'e')])).toBe(true) // A baixa
    expect(isSequencia([C(12, 'p'), C(13, 'p'), C(1, 'p')])).toBe(true) // A alta (Q-K-A)
    expect(isSequencia([C(13, 'p'), C(1, 'p'), C(2, 'p')])).toBe(false) // virar a esquina não
  })

  it('particiona9 encontra os 3 jogos (e recusa mão que não fecha)', () => {
    const fecha = [
      C(7, 'o'), C(7, 'c'), C(7, 'p'), // trinca
      C(4, 'c'), C(5, 'c'), C(6, 'c'), // sequência
      C(12, 'e'), C(13, 'e'), C(1, 'e'), // A alta
    ]
    expect(particiona9(fecha)).not.toBeNull()
    // embaralhada também fecha (a ordem não importa)
    const bagunca = [fecha[3]!, fecha[8]!, fecha[0]!, fecha[5]!, fecha[1]!, fecha[6]!, fecha[2]!, fecha[4]!, fecha[7]!]
    expect(particiona9(bagunca)).not.toBeNull()
    const naoFecha = [...fecha.slice(0, 8), C(9, 'o')]
    expect(particiona9(naoFecha)).toBeNull()
  })

  it('melhorBatida acha o descarte certo e respeita a carta presa do lixo', () => {
    const mao10 = [
      C(7, 'o'), C(7, 'c'), C(7, 'p'),
      C(4, 'c'), C(5, 'c'), C(6, 'c'),
      C(12, 'e'), C(13, 'e'), C(1, 'e'),
      C(9, 'o'), // sobra — é o descarte
    ]
    const batida = melhorBatida(mao10)
    expect(batida?.descarte).toBe(9)
    // se a sobra estiver PRESA (veio do lixo), não há batida
    expect(melhorBatida(mao10, 9)).toBeNull()
  })
})

describe('Pife — partida', () => {
  function estado2p(): PifeState {
    const s = initialPifeState(2)
    s.maos[0] = [
      C(7, 'o'), C(7, 'c'), C(7, 'p'),
      C(4, 'c'), C(5, 'c'), C(6, 'c'),
      C(12, 'e'), C(13, 'e'), C(9, 'o'), // falta o A♠ p/ fechar Q-K-A
    ]
    // mão do rival também determinística (sem 7) p/ o teste de vazamento
    s.maos[1] = [
      C(2, 'o'), C(3, 'o'), C(10, 'o'),
      C(2, 'c'), C(3, 'c'), C(10, 'c'),
      C(2, 'e'), C(3, 'e'), C(10, 'e'),
    ]
    s.lixo = [C(11, 'p')] // topo do lixo é público — determinístico no teste
    s.turno = 0
    s.fase = 'comprando'
    return s
  }

  it('MÃO ESCONDIDA: a mão do rival nunca trafega', () => {
    const s = estado2p()
    const view1 = JSON.stringify(pifeViewFor(s, 1))
    expect(view1).not.toContain('"r":7') // trinca do seat 0
    expect(pifeViewFor(s, 1).minhaMao).toHaveLength(9)
    expect(pifeViewFor(s, -1).minhaMao).toHaveLength(0) // espectador
    expect(pifeViewFor(s, 0).cartasRestantes).toEqual([9, 9])
  })

  it('fluxo: compra do monte, descarta e a vez passa', () => {
    const s = estado2p()
    const fora = aplicaPifeAction(s, 1, { type: 'monte' })
    expect('error' in fora).toBe(true) // não é a vez do 1
    aplicaPifeAction(s, 0, { type: 'monte' })
    expect(s.maos[0]).toHaveLength(10)
    expect(s.fase).toBe('descartando')
    const semComprar = aplicaPifeAction(s, 0, { type: 'monte' })
    expect('error' in semComprar).toBe(true)
    aplicaPifeAction(s, 0, { type: 'descartar', index: 9 })
    expect(s.maos[0]).toHaveLength(9)
    expect(s.turno).toBe(1)
    expect(s.fase).toBe('comprando')
  })

  it('quem compra do lixo não pode descartar a mesma carta', () => {
    const s = estado2p()
    s.lixo = [C(2, 'o')]
    aplicaPifeAction(s, 0, { type: 'lixo' })
    expect(s.presaDoLixo).toBe(9)
    const devolve = aplicaPifeAction(s, 0, { type: 'descartar', index: 9 })
    expect('error' in devolve).toBe(true)
    aplicaPifeAction(s, 0, { type: 'descartar', index: 8 })
    expect(s.turno).toBe(1)
  })

  it('BATER: comprar a carta que fecha vence; sem fechar é erro', () => {
    const s = estado2p()
    const cedo = aplicaPifeAction(s, 0, { type: 'bater' })
    expect('error' in cedo).toBe(true) // precisa comprar antes
    s.monte.push(C(1, 'e')) // o próximo do monte fecha Q-K-A ♠
    aplicaPifeAction(s, 0, { type: 'monte' })
    const r = aplicaPifeAction(s, 0, { type: 'bater' })
    expect('error' in r).toBe(false)
    expect(s.fase).toBe('fim')
    expect(s.vencedor).toBe(0)
    expect(s.gruposVencedores).toHaveLength(3)
    expect(pifeViewFor(s, 1).gruposVencedores).toHaveLength(3) // revelado no fim
  })

  it('mão que não bate recebe erro ao tentar', () => {
    const s = estado2p()
    s.monte.push(C(2, 'o')) // não fecha nada
    aplicaPifeAction(s, 0, { type: 'monte' })
    const r = aplicaPifeAction(s, 0, { type: 'bater' })
    expect('error' in r).toBe(true)
    expect(s.fase).toBe('descartando')
  })
})
