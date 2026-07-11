import { describe, expect, it } from 'vitest'
import {
  PAREO_APOSTAS_MS,
  PAREO_CAVALOS,
  PAREO_CERIMONIA_MS,
  PAREO_CORRIDA_MS,
  PAREO_FINISH,
  PAREO_ODDS,
  PAREO_PRELARGADA_MS,
  PAREO_SIM_STEPS,
  pareoBuildRace,
  pareoHorseAt,
  type PareoView,
} from '@mesapop/shared'
import { avancaCiclo, novoPareo, pareoModule } from '../src/games/pareo'

describe('Páreo — simulação determinística (portada do protótipo)', () => {
  it('mesma seed = mesma corrida (vencedor, ordem e trajetória)', () => {
    const a = pareoBuildRace(123456)
    const b = pareoBuildRace(123456)
    expect(a.vencedor).toBe(b.vencedor)
    expect(a.ordem).toEqual(b.ordem)
    expect(a.winCrossT).toBe(b.winCrossT)
    for (let s = 0; s <= PAREO_SIM_STEPS; s += 50) {
      expect(a.cavalos[0]!.traj[s]).toBe(b.cavalos[0]!.traj[s])
    }
  })

  it('o vencedor da timeline CRUZA a linha (vencedor visual == real)', () => {
    for (const seed of [7, 999, 424242, 2026]) {
      const r = pareoBuildRace(seed)
      const w = r.cavalos[r.vencedor]!
      expect(w.traj[PAREO_SIM_STEPS]).toBeGreaterThanOrEqual(PAREO_FINISH)
      expect(r.winCrossT).toBeGreaterThan(0.5) // cruzamento perto do fim
      expect(r.winCrossT).toBeLessThanOrEqual(1)
      // ninguém cruza ANTES do vencedor
      for (const c of r.cavalos) {
        if (c.lane === r.vencedor) continue
        const noCruzamento = pareoHorseAt(c, r.winCrossT).x
        expect(noCruzamento).toBeLessThanOrEqual(PAREO_FINISH + 1)
      }
    }
  })

  it('favoritismo calibrado: em muitas corridas, o favorito vence mais', () => {
    const vitorias = [0, 0, 0, 0]
    for (let seed = 1; seed <= 600; seed++) vitorias[pareoBuildRace(seed).vencedor]!++
    // ordem dos pesos preservada (34 > 28 > 22 > 16), com folga estatística
    expect(vitorias[0]).toBeGreaterThan(vitorias[3]!)
    expect(vitorias[0]! + vitorias[1]!).toBeGreaterThan(vitorias[2]! + vitorias[3]!)
    // todo cavalo vence às vezes (corridas disputadas, nada é fixo)
    vitorias.forEach((v) => expect(v).toBeGreaterThan(20))
  })

  it('odds fixas com margem da banca (favorito paga menos)', () => {
    expect(PAREO_ODDS).toHaveLength(4)
    expect(PAREO_ODDS[0]).toBeLessThan(PAREO_ODDS[3]!)
    PAREO_ODDS.forEach((o) => expect(o).toBeGreaterThanOrEqual(1.2))
  })
})

describe('Páreo — ciclo autoritativo do servidor', () => {
  it('fases avançam pelos timestamps oficiais: apostas → pré-largada → corrida → cerimônia → próximo páreo', () => {
    const s = novoPareo(1, [])
    expect(s.fase).toBe('apostas')
    expect(s.faseFimEm - Date.now()).toBeGreaterThan(PAREO_APOSTAS_MS - 1000)

    // retroage os relógios para simular o tempo passando (sem esperar)
    avancaCiclo(s, s.faseFimEm) // fim das apostas
    expect(s.fase).toBe('prelargada')
    expect(s.faseFimEm).toBe(s.largadaEm)

    avancaCiclo(s, s.largadaEm) // largada!
    expect(s.fase).toBe('corrida')

    avancaCiclo(s, s.faseFimEm) // vencedor cruzou (+ folga)
    expect(s.fase).toBe('cerimonia')
    expect(s.historico[0]).toBe(PAREO_CAVALOS[s.vencedor]!.nome)
    expect(s.faseFimEm).toBe(s.largadaEm + PAREO_CORRIDA_MS + PAREO_CERIMONIA_MS)

    const fimDoCiclo = s.faseFimEm
    avancaCiclo(s, fimDoCiclo) // cerimônia acabou → páreo 2 começa NA HORA
    expect(s.numero).toBe(2)
    expect(s.fase).toBe('apostas')
    expect(s.faseFimEm).toBe(fimDoCiclo + PAREO_APOSTAS_MS)
    expect(s.historico).toHaveLength(1) // histórico atravessa os páreos
  })

  it('servidor parado atravessa VÁRIAS fases de uma vez sem se perder', () => {
    const s = novoPareo(1, [])
    // pula direto para depois do fim do ciclo inteiro (~180s adiante)
    avancaCiclo(s, s.largadaEm + PAREO_CORRIDA_MS + PAREO_CERIMONIA_MS + 5000)
    expect(s.numero).toBe(2)
    expect(s.fase).toBe('apostas')
  })

  it('a view NUNCA vaza a seed/vencedor antes da largada', () => {
    const s = novoPareo(1, [])
    let v = pareoModule.getStateFor(s, 0) as PareoView
    expect(v.seed).toBeNull()
    expect(v.vencedor).toBeNull()
    expect(v.largadaEm - v.agora).toBeGreaterThan(PAREO_PRELARGADA_MS)

    avancaCiclo(s, s.faseFimEm) // pré-largada: apostas fechadas, seed ainda oculta
    v = pareoModule.getStateFor(s, 0) as PareoView
    expect(v.seed).toBeNull()

    avancaCiclo(s, s.largadaEm) // corrida: seed liberada (resultado já fixado)
    v = pareoModule.getStateFor(s, 0) as PareoView
    expect(v.seed).toBe(s.seed)
    expect(v.vencedor).toBeNull() // o vencedor "oficial" só na cerimônia

    avancaCiclo(s, s.faseFimEm)
    v = pareoModule.getStateFor(s, 0) as PareoView
    expect(v.vencedor).toBe(s.vencedor)
  })

  it('apostar ainda não vale (FASE 2) e a partida é contínua', () => {
    const s = novoPareo(1, [])
    const r = pareoModule.play(s, 0, { type: 'apostar' })
    expect('error' in r).toBe(true)
    expect(pareoModule.result(s).finished).toBe(false)
  })
})
