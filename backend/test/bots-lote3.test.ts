import { describe, expect, it } from 'vitest'
import type { GameModule } from '../src/games/module'
import { initialMemoriaState, memoriaModule, type MemoriaState } from '../src/games/memoria'
import { initialForcaState, forcaModule, type ForcaState } from '../src/games/forca'
import { initialTrucoState, trucoModule, type TrucoState } from '../src/games/truco'

/** roda bot × bot até acabar, exigindo que toda jogada seja LEGAL */
function jogaSozinho<S>(mod: GameModule<S>, estado: S, guard = 5000): { s: S; passos: number } {
  let s = estado
  let passos = 0
  while (passos++ < guard) {
    const seat = mod.currentSeat!(s)
    if (seat === null || seat === undefined) break
    const acao = mod.bot!(s, seat)
    if (!acao) throw new Error(`${mod.slug}: bot não retornou ação no assento ${seat}`)
    const r = mod.play(s, seat, acao)
    if ('error' in r) throw new Error(`${mod.slug}: ação ilegal — ${r.error}`)
    s = r.state
  }
  return { s, passos }
}

describe('Bots Lote 3 — jogos de turno', () => {
  it('Memória: o bot usa a memória pública para completar um par conhecido', () => {
    const s = initialMemoriaState(2)
    // acha duas posições com o MESMO valor e finge que já foram vistas
    const v = s.valores[0]!
    const par = s.valores.map((val, i) => ({ val, i })).filter((x) => x.val === v).map((x) => x.i)
    expect(par.length).toBe(2)
    s.vistas[par[0]!] = v
    s.vistas[par[1]!] = v
    s.turno = 0
    // o bot lembra ~82% das vezes; em 20 tentativas, a maioria deve mirar o par
    let acertos = 0
    for (let t = 0; t < 20; t++) {
      const a = memoriaModule.bot!(s, 0)!
      if (a.type === 'virar' && par.includes((a as { index: number }).index)) acertos++
    }
    expect(acertos).toBeGreaterThanOrEqual(10)
  })

  it('Memória: bot × bot limpa o tabuleiro (todas as jogadas legais)', () => {
    const { s } = jogaSozinho<MemoriaState>(memoriaModule, initialMemoriaState(2))
    expect(s.fim).toBe(true)
    expect(s.donos.every((d) => d !== -1)).toBe(true)
  })

  it('Forca: bot × bot conclui as rodadas (escolhe palavra + adivinha por frequência)', () => {
    const { s } = jogaSozinho<ForcaState>(forcaModule, initialForcaState(2))
    expect(s.fase).toBe('fim')
    expect(s.vencedores.length).toBeGreaterThanOrEqual(1)
  })

  it('Truco: bot × bot joga até 12 tentos, tudo legal', () => {
    const { s } = jogaSozinho<TrucoState>(trucoModule, initialTrucoState(2))
    expect(s.fase).toBe('fim')
    expect(Math.max(s.placar[0], s.placar[1])).toBeGreaterThanOrEqual(12)
    expect(s.vencedores.length).toBeGreaterThan(0)
  })

  it('currentSeat aponta o jogador certo em cada jogo', () => {
    expect(memoriaModule.currentSeat!(initialMemoriaState(2))).toBe(0)
    expect(forcaModule.currentSeat!(initialForcaState(2))).toBe(0) // escolhedor
    expect(trucoModule.currentSeat!(initialTrucoState(2))).toBe(0)
  })
})
