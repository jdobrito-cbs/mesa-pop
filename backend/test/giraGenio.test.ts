import { describe, expect, it } from 'vitest'
import { GG_META, type GGView } from '@mesapop/shared'
import { giraGenioModule, initialGiraGenioState, type GGState } from '../src/games/giraGenio'

function girar(s: GGState, seat: number): GGState {
  const r = giraGenioModule.play(s, seat, { type: 'girar' })
  if ('error' in r) throw new Error(r.error)
  return r.state
}
function responde(s: GGState, seat: number, opcao: number): GGState {
  const r = giraGenioModule.play(s, seat, { type: 'responder', opcao })
  if ('error' in r) throw new Error(r.error)
  return r.state
}

describe('Gira Gênio', () => {
  it('girar sorteia categoria e pergunta; só o jogador da vez joga', () => {
    const s = girar(initialGiraGenioState(2), 0)
    expect(s.fase).toBe('pergunta')
    expect(s.categoria).not.toBeNull()
    expect(s.pergunta).not.toBeNull()
    expect(s.pergunta!.opcoes.length).toBe(4)
    const r = giraGenioModule.play(s, 1, { type: 'girar' })
    expect('error' in r).toBe(true)
  })

  it('acertar ganha a coroa da categoria e mantém a vez; errar passa a vez', () => {
    let s = girar(initialGiraGenioState(2), 0)
    const cat = s.categoria!
    const acertou = responde(s, 0, s.pergunta!.correta)
    expect(acertou.coroas[0]).toContain(cat)
    expect(acertou.turn).toBe(0) // joga de novo

    s = girar(initialGiraGenioState(2), 0)
    const errada = (s.pergunta!.correta + 1) % 4
    const errou = responde(s, 0, errada)
    expect(errou.coroas[0]!.length).toBe(0)
    expect(errou.turn).toBe(1) // passou a vez
    expect(errou.ultimo!.acertou).toBe(false)
  })

  it('a resposta correta NUNCA aparece na visão do cliente', () => {
    const s = girar(initialGiraGenioState(2), 0)
    const view = giraGenioModule.getStateFor!(s, 0) as GGView
    expect(view.pergunta).not.toBeNull()
    expect(JSON.stringify(view)).not.toContain('"correta"')
    // a view tem as opções, mas não expõe qual é a certa
    expect(view.pergunta!.opcoes.length).toBe(4)
  })

  it('junta 6 coroas e vence', () => {
    let s = initialGiraGenioState(2)
    const vistas = new Set<string>()
    let guarda = 0
    while (s.fase !== 'fim' && guarda++ < 300) {
      s = girar(s, s.turn)
      // responde sempre certo até ganhar todas as coroas
      s = responde(s, s.turn, s.pergunta ? s.pergunta.correta : 0)
      vistas.add(s.ultimo!.categoria)
    }
    expect(s.fase).toBe('fim')
    expect(s.winnerSeats.length).toBe(1)
    expect(s.coroas[s.winnerSeats[0]!]!.length).toBe(GG_META)
  })

  it('currentSeat é a vez; o bot gira e depois responde', () => {
    let s = initialGiraGenioState(2)
    expect(giraGenioModule.currentSeat!(s)).toBe(0)
    const a1 = giraGenioModule.bot!(s, 0)
    expect(a1).toEqual({ type: 'girar' })
    s = girar(s, 0)
    const a2 = giraGenioModule.bot!(s, 0)
    expect(a2?.type).toBe('responder')
  })
})
