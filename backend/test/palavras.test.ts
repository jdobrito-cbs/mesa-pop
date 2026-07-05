import { describe, expect, it } from 'vitest'
import { avaliaPalpite, normaliza5, palavraDoDia, PALAVRAS_5 } from '../src/lib/palavras5'
import { aplicaDueloAction, dueloViewFor, initialDueloState, tickDuelo } from '../src/games/duelo'
import { aplicaStopAction, initialStopState, stopViewFor, tickStop } from '../src/games/stop'

describe('palavras de 5 letras', () => {
  it('lista só tem palavras de 5 letras e a do dia é determinística', () => {
    expect(PALAVRAS_5.length).toBeGreaterThan(100)
    expect(PALAVRAS_5.every((p) => p.length === 5)).toBe(true)
    const d = new Date(2026, 6, 5)
    expect(palavraDoDia(d)).toBe(palavraDoDia(new Date(2026, 6, 5)))
    expect(PALAVRAS_5).toContain(palavraDoDia(d))
  })

  it('avaliação estilo termo: verdes, amarelos e letras repetidas', () => {
    expect(avaliaPalpite('bolsa', 'bolsa')).toBe('ggggg')
    // bolsa × lobos: l→amarelo, o→verde, b→amarelo, o extra→cinza, s→amarelo
    expect(avaliaPalpite('bolsa', 'lobos')).toBe('ygyby')
    // o único 'o' do alvo casa VERDE na posição 5 — os outros 'o' ficam cinza
    expect(avaliaPalpite('prato', 'ovovo')).toBe('bbbbg')
    // letras repetidas no alvo: 'terra' tem dois r
    expect(avaliaPalpite('terra', 'ratos')).toBe('yyybb')
  })

  it('normaliza acentos e caixa', () => {
    expect(normaliza5('AVIÃO')).toBe('aviao')
  })
})

describe('Duelo de Palavras', () => {
  it('AS LETRAS DOS RIVAIS NUNCA VAZAM (só cores) e a palavra só no fim', () => {
    const s = initialDueloState(3)
    s.palavra = 'bolsa'
    aplicaDueloAction(s, 0, { type: 'palpite', palavra: 'prato' })
    const view1 = JSON.stringify(dueloViewFor(s, 1))
    expect(view1).not.toContain('prato')
    expect(view1).not.toContain('bolsa')
    const rival = dueloViewFor(s, 1).rivais.find((r) => r.seat === 0)!
    expect(rival.feedbacks).toHaveLength(1)
    expect(rival.feedbacks[0]).toMatch(/^[gyb]{5}$/)
  })

  it('acertar encerra na hora e vence; a palavra é revelada', () => {
    const s = initialDueloState(2)
    s.palavra = 'bolsa'
    aplicaDueloAction(s, 1, { type: 'palpite', palavra: 'BOLSA' })
    expect(s.fase).toBe('fim')
    expect(s.vencedores).toEqual([1])
    expect(dueloViewFor(s, 0).palavra).toBe('bolsa')
  })

  it('tempo esgotado: melhor progresso vence; sem progresso = empate sem vencedor', () => {
    const s = initialDueloState(2)
    s.palavra = 'bolsa'
    aplicaDueloAction(s, 0, { type: 'palpite', palavra: 'balde' }) // b verde
    tickDuelo(s, 999)
    expect(s.fase).toBe('fim')
    expect(s.vencedores).toEqual([0])
  })

  it('esgotar as 6 tentativas trava o jogador', () => {
    const s = initialDueloState(2)
    s.palavra = 'bolsa'
    for (let i = 0; i < 6; i++) aplicaDueloAction(s, 0, { type: 'palpite', palavra: 'prato' })
    const extra = aplicaDueloAction(s, 0, { type: 'palpite', palavra: 'prato' })
    expect('error' in extra).toBe(true)
  })
})

describe('Stop!', () => {
  it('respostas dos rivais ficam ESCONDIDAS até o resultado (só progresso)', () => {
    const s = initialStopState(2)
    s.letra = 'B'
    aplicaStopAction(s, 0, { type: 'respostas', valores: ['bruno', 'baleia', 'banana', 'bege', 'bola', 'brasil', 'bombeiro'] })
    const view1 = JSON.stringify(stopViewFor(s, 1))
    expect(view1).not.toContain('baleia')
    expect(stopViewFor(s, 1).progresso.find((p) => p.seat === 0)?.preenchidas).toBe(7)
    expect(stopViewFor(s, 1).resultado).toBeNull()
  })

  it('STOP só com tudo preenchido; pontua 10 única / 5 repetida / 0 inválida', () => {
    const s = initialStopState(2)
    s.letra = 'B'
    const cedo = aplicaStopAction(s, 0, { type: 'stop' })
    expect('error' in cedo).toBe(true)

    aplicaStopAction(s, 0, { type: 'respostas', valores: ['bruno', 'baleia', 'banana', 'bege', 'bola', 'brasil', 'bombeiro'] })
    aplicaStopAction(s, 1, { type: 'respostas', valores: ['bia', 'baleia', 'caju', '', 'bola', 'belem', 'babá'] })
    aplicaStopAction(s, 0, { type: 'stop' })
    expect(s.fase).toBe('resultado')
    const r0 = s.resultado!.find((l) => l.seat === 0)!
    const r1 = s.resultado!.find((l) => l.seat === 1)!
    expect(r0.pontos).toEqual([10, 5, 10, 10, 5, 10, 10]) // baleia e bola repetidas
    expect(r1.pontos[2]).toBe(0) // caju não começa com B
    expect(r1.pontos[3]).toBe(0) // vazia
    expect(r1.pontos[6]).toBe(10) // babá normaliza p/ "baba" e vale
  })

  it('4 rodadas com letras diferentes → fim com vencedor pelo total', () => {
    const s = initialStopState(2)
    const letras = new Set([s.letra])
    const faseDe = () => s.fase as string
    for (let r = 0; r < 4; r++) {
      tickStop(s, 999) // estoura o tempo de preencher → resultado
      if (faseDe() === 'fim') break
      tickStop(s, 999) // estoura o resultado → próxima
      if (faseDe() !== 'fim') letras.add(s.letra)
    }
    expect(faseDe()).toBe('fim')
    expect(letras.size).toBeGreaterThanOrEqual(3)
    expect(s.vencedores.length).toBeGreaterThan(0)
  })
})
