import { describe, expect, it } from 'vitest'
import { normalizaForca } from '@mesapop/shared'
import {
  aplicaForcaAction,
  forcaViewFor,
  initialForcaState,
} from '../src/games/forca'
import {
  aplicaBingoAction,
  bingoViewFor,
  initialBingoState,
  tickBingo,
} from '../src/games/bingo'

describe('Forca', () => {
  it('normaliza: maiúsculas, sem acento, só letras', () => {
    expect(normalizaForca('  chu-vei ro! ')).toBe('CHUVEIRO')
    expect(normalizaForca('coração')).toBe('CORACAO')
  })

  it('A PALAVRA NUNCA VAZA para quem adivinha', () => {
    const s = initialForcaState(3)
    aplicaForcaAction(s, 0, { type: 'palavra', palavra: 'jabuti' })
    const view1 = forcaViewFor(s, 1)
    expect(JSON.stringify(view1)).not.toContain('JABUTI')
    expect(view1.palavraVista).toEqual([null, null, null, null, null, null])
    // o escolhedor vê tudo
    expect(forcaViewFor(s, 0).palavraVista.join('')).toBe('JABUTI')
    // espectador não vê nada oculto
    expect(JSON.stringify(forcaViewFor(s, -1))).not.toContain('JABUTI')
  })

  it('letra certa revela, pontua e MANTÉM a vez; errada cresce a forca e passa', () => {
    const s = initialForcaState(3)
    aplicaForcaAction(s, 0, { type: 'palavra', palavra: 'arara' })
    expect(s.turno).toBe(1)
    aplicaForcaAction(s, 1, { type: 'letra', letra: 'a' })
    expect(s.pontos[1]).toBe(30) // 3 ocorrências ×10
    expect(s.turno).toBe(1) // joga de novo
    const repetida = aplicaForcaAction(s, 1, { type: 'letra', letra: 'a' })
    expect('error' in repetida).toBe(true)
    aplicaForcaAction(s, 1, { type: 'letra', letra: 'x' })
    expect(s.erros).toBe(1)
    expect(s.pontos[0]).toBe(8) // escolhedor lucra com o erro
    expect(s.turno).toBe(2) // passou (pulando o escolhedor)
  })

  it('completar a palavra fecha a rodada e RODA o escolhedor', () => {
    const s = initialForcaState(2)
    aplicaForcaAction(s, 0, { type: 'palavra', palavra: 'sol' })
    aplicaForcaAction(s, 1, { type: 'letra', letra: 's' })
    aplicaForcaAction(s, 1, { type: 'letra', letra: 'o' })
    aplicaForcaAction(s, 1, { type: 'letra', letra: 'l' })
    expect(s.pontos[1]).toBe(30 + 40) // 3 letras + bônus
    expect(s.rodada).toBe(1)
    expect(s.escolhedor).toBe(1)
    expect(s.fase).toBe('escolhendo')
  })

  it('6 erros enforcam (escolhedor +50) e a última rodada encerra a partida', () => {
    const s = initialForcaState(2)
    s.rodada = 1
    s.escolhedor = 1
    s.turno = 0
    aplicaForcaAction(s, 1, { type: 'palavra', palavra: 'zzz' })
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f']) aplicaForcaAction(s, 0, { type: 'letra', letra: l })
    expect(s.fase).toBe('fim')
    expect(s.pontos[1]).toBe(6 * 8 + 50)
    expect(s.vencedores).toEqual([1])
  })

  it('chute certo leva bônus; chute errado conta na forca', () => {
    const s = initialForcaState(2)
    aplicaForcaAction(s, 0, { type: 'palavra', palavra: 'gato' })
    aplicaForcaAction(s, 1, { type: 'chute', palavra: 'pato' })
    expect(s.erros).toBe(1)
    aplicaForcaAction(s, 1, { type: 'chute', palavra: 'gato' })
    expect(s.pontos[1]).toBe(60 + 4 * 2) // bônus + 2 por letra oculta
    expect(s.rodada).toBe(1)
  })
})

describe('Bingo', () => {
  it('cartela 5×5: colunas nas faixas certas e centro livre', () => {
    const s = initialBingoState(2)
    for (const cartela of s.cartelas) {
      expect(cartela).toHaveLength(25)
      expect(cartela[12]).toBe(0)
      for (let i = 0; i < 25; i++) {
        if (i === 12) continue
        const c = i % 5
        expect(cartela[i]).toBeGreaterThanOrEqual(c * 15 + 1)
        expect(cartela[i]).toBeLessThanOrEqual(c * 15 + 15)
      }
      // sem repetidos
      expect(new Set(cartela.filter((n) => n !== 0)).size).toBe(24)
    }
  })

  it('o tick canta bolas no ritmo, sem repetir', () => {
    const s = initialBingoState(2)
    for (let t = 0; t < 80; t++) tickBingo(s, 0.5) // 40s
    expect(s.bolas.length).toBeGreaterThanOrEqual(10)
    expect(new Set(s.bolas).size).toBe(s.bolas.length)
  })

  it('só marca número JÁ cantado; espectador não joga', () => {
    const s = initialBingoState(2)
    const numero = s.cartelas[0]![0]!
    const cedo = aplicaBingoAction(s, 0, { type: 'marcar', index: 0 })
    expect('error' in cedo).toBe(true) // ainda não cantada
    s.bolas.push(numero)
    const ok = aplicaBingoAction(s, 0, { type: 'marcar', index: 0 })
    expect('error' in ok).toBe(false)
    expect(s.marcadas[0]![0]).toBe(true)
    expect('error' in aplicaBingoAction(s, -1, { type: 'bingo' })).toBe(true)
  })

  it('BINGO! falso é recusado; linha completa vence e encerra', () => {
    const s = initialBingoState(2)
    const falso = aplicaBingoAction(s, 0, { type: 'bingo' })
    expect('error' in falso).toBe(true)
    // marca a linha do meio (índices 10..14; 12 já é livre)
    for (const i of [10, 11, 13, 14]) {
      s.bolas.push(s.cartelas[0]![i]!)
      aplicaBingoAction(s, 0, { type: 'marcar', index: i })
    }
    aplicaBingoAction(s, 0, { type: 'bingo' })
    expect(s.fase).toBe('fim')
    expect(s.vencedor).toBe(0)
    expect(s.linhaVencedora).toEqual([10, 11, 12, 13, 14])
    const view = bingoViewFor(s, 1)
    expect(view.vencedor).toBe(0)
    expect(view.rivais[0]!.marcadas).toBe(5)
  })
})
