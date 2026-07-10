import { describe, expect, it } from 'vitest'
import { MAGNATA_CORES } from '@mesapop/shared'
import { initialMagnataState, magnataModule } from '../src/games/magnata'

describe('Magnata — cor do peão', () => {
  it('troca a cor antes de rolar, mesmo fora do turno', () => {
    const s = initialMagnataState(3)
    // o turno é do assento 0; o assento 2 troca de cor fora do turno
    const usadas = s.jogadores.map((j) => j.cor)
    const nova = MAGNATA_CORES.find((c) => !usadas.includes(c))!
    const r = magnataModule.play(s, 2, { type: 'cor', cor: nova })
    expect('state' in r).toBe(true)
    expect(s.jogadores[2]!.cor).toBe(nova)
  })

  it('recusa cor já usada por outro jogador', () => {
    const s = initialMagnataState(2)
    const corDoOutro = s.jogadores[1]!.cor
    const r = magnataModule.play(s, 0, { type: 'cor', cor: corDoOutro })
    expect('error' in r).toBe(true)
    expect(s.jogadores[0]!.cor).not.toBe(corDoOutro)
  })

  it('recusa cor fora da paleta', () => {
    const s = initialMagnataState(2)
    const r = magnataModule.play(s, 0, { type: 'cor', cor: '#000000' })
    expect('error' in r).toBe(true)
  })

  it('depois de rolar, não pode mais trocar', () => {
    const s = initialMagnataState(2)
    magnataModule.play(s, 0, { type: 'rolar' })
    expect(s.jogadores[0]!.jaRolou).toBe(true)
    const nova = MAGNATA_CORES.find((c) => c !== s.jogadores[0]!.cor)!
    const r = magnataModule.play(s, 0, { type: 'cor', cor: nova })
    expect('error' in r).toBe(true)
    expect(s.jogadores[0]!.cor).not.toBe(nova)
  })

  it('initialMagnataState(6) dá 6 cores distintas', () => {
    const s = initialMagnataState(6)
    const cores = s.jogadores.map((j) => j.cor)
    expect(new Set(cores).size).toBe(6)
    for (const c of cores) expect(MAGNATA_CORES).toContain(c)
  })
})
