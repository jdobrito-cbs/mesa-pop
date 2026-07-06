import { describe, expect, it } from 'vitest'
import { QUIZ_TEMPO_PERGUNTA } from '@mesapop/shared'
import {
  aplicaQuizAction,
  initialQuizState,
  quizViewFor,
  tickQuiz,
} from '../src/games/quiz'
import { QUIZ_NOSTALGIA, QUIZ_POP, type QuizPergunta } from '../src/lib/quizPerguntas'

const BANCO: QuizPergunta[] = [
  { c: 'Teste', p: 'Quanto é 2+2?', alts: ['4', '3', '5', '22'] },
  { c: 'Teste', p: 'Cor do céu limpo?', alts: ['Azul', 'Verde', 'Roxo', 'Preto'] },
]

describe('Quiz — bancos de perguntas', () => {
  it.each([
    ['QUIZ_POP', QUIZ_POP],
    ['QUIZ_NOSTALGIA', QUIZ_NOSTALGIA],
  ])('%s: tamanho, 4 alternativas ÚNICAS e sem vazio', (_nome, banco) => {
    expect(banco.length).toBeGreaterThanOrEqual(30)
    for (const q of banco) {
      expect(q.alts).toHaveLength(4)
      expect(new Set(q.alts).size).toBe(4)
      expect(q.p.length).toBeGreaterThan(8)
      expect(q.alts.every((a) => a.trim().length > 0)).toBe(true)
    }
  })
})

describe('Quiz — engine', () => {
  it('embaralha as alternativas mas rastreia a correta', () => {
    const s = initialQuizState(2, BANCO)
    expect(s.perguntas).toHaveLength(2)
    for (const p of s.perguntas) {
      const original = BANCO.find((q) => q.p === p.p)!
      expect(p.ops[p.correta]).toBe(original.alts[0])
      expect([...p.ops].sort()).toEqual([...original.alts].sort())
    }
  })

  it('A CORRETA NÃO VAZA durante a pergunta (nem as respostas alheias)', () => {
    const s = initialQuizState(2, BANCO)
    aplicaQuizAction(s, 0, { type: 'resposta', index: 1 })
    const view1 = quizViewFor(s, 1)
    expect(view1.correta).toBeNull()
    expect(view1.respostas).toBeNull()
    expect(view1.responderam).toEqual([true, false]) // sabe QUE respondeu, não O QUE
    expect(view1.minhaResposta).toBeNull()
    expect(quizViewFor(s, 0).minhaResposta).toBe(1)
  })

  it('resposta trava (sem trocar) e espectador não responde', () => {
    const s = initialQuizState(2, BANCO)
    aplicaQuizAction(s, 0, { type: 'resposta', index: 0 })
    expect('error' in aplicaQuizAction(s, 0, { type: 'resposta', index: 2 })).toBe(true)
    expect('error' in aplicaQuizAction(s, -1, { type: 'resposta', index: 0 })).toBe(true)
  })

  it('todos respondendo revela na hora, com bônus de rapidez ao mais veloz', () => {
    const s = initialQuizState(2, BANCO)
    const certa = s.perguntas[0]!.correta
    aplicaQuizAction(s, 0, { type: 'resposta', index: certa }) // rápido (15s restantes)
    s.tempo = 5 // o outro demorou
    aplicaQuizAction(s, 1, { type: 'resposta', index: certa })
    tickQuiz(s, 0.25)
    expect(s.fase).toBe('revelacao')
    expect(s.ganhoUltima[0]).toBe(150) // 100 + 50×(15/15)
    expect(s.ganhoUltima[1]).toBe(100 + Math.round((50 * 5) / QUIZ_TEMPO_PERGUNTA))
    const view = quizViewFor(s, 1)
    expect(view.correta).toBe(certa)
    expect(view.respostas).toEqual([certa, certa])
  })

  it('tempo esgotado revela (sem pontos p/ quem não respondeu) e o fim aponta o campeão', () => {
    const s = initialQuizState(2, BANCO)
    const certa0 = s.perguntas[0]!.correta
    aplicaQuizAction(s, 0, { type: 'resposta', index: certa0 })
    s.tempo = 0.1
    tickQuiz(s, 0.25) // estoura o tempo → revelação
    expect(s.fase).toBe('revelacao')
    expect(s.ganhoUltima[1]).toBe(0)
    s.tempo = 0.1
    tickQuiz(s, 0.25) // fim da revelação → rodada 2
    expect(s.fase).toBe('pergunta')
    expect(s.rodada).toBe(1)
    const errada = (s.perguntas[1]!.correta + 1) % 4
    aplicaQuizAction(s, 0, { type: 'resposta', index: s.perguntas[1]!.correta })
    aplicaQuizAction(s, 1, { type: 'resposta', index: errada })
    tickQuiz(s, 0.25)
    s.tempo = 0.1
    tickQuiz(s, 0.25) // fecha a última rodada
    expect(s.fase).toBe('fim')
    expect(s.vencedores).toEqual([0])
    expect(s.placar[0]).toBeGreaterThan(s.placar[1]!)
  })
})
