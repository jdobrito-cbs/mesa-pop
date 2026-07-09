import { describe, expect, it } from 'vitest'
import { botTickQuiz, initialQuizState, tickQuiz } from '../src/games/quiz'
import { QUIZ_POP } from '../src/lib/quizPerguntas'

describe('Bot do Quiz (Lote 4, realtime)', () => {
  it('o bot responde (índice válido) quando o tempo aperta', () => {
    const s = initialQuizState(2, QUIZ_POP)
    s.tempo = 1 // força a resposta
    botTickQuiz(s, [1])
    expect(s.respostas[1]).not.toBeNull()
    const ops = s.perguntas[s.rodada]!.ops.length
    expect(s.respostas[1]!).toBeGreaterThanOrEqual(0)
    expect(s.respostas[1]!).toBeLessThan(ops)
    expect(s.respostas[0]).toBeNull() // não responde por quem não é bot
  })

  it('com todos os assentos sendo bots, a rodada é revelada', () => {
    const s = initialQuizState(2, QUIZ_POP)
    s.tempo = 1
    botTickQuiz(s, [0, 1])
    expect(s.respostas.every((r) => r !== null)).toBe(true)
    tickQuiz(s, 0.25)
    expect(s.fase).toBe('revelacao')
  })

  it('acerta com boa frequência (~70%)', () => {
    let acertos = 0
    const N = 60
    for (let t = 0; t < N; t++) {
      const s = initialQuizState(2, QUIZ_POP)
      s.tempo = 1
      botTickQuiz(s, [1])
      if (s.respostas[1] === s.perguntas[s.rodada]!.correta) acertos++
    }
    expect(acertos).toBeGreaterThan(N * 0.45) // folga p/ variância
    expect(acertos).toBeLessThan(N) // não é 100% (às vezes erra)
  })
})
