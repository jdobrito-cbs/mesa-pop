import { describe, expect, it } from 'vitest'
import { normalizaPalavra, dicaDe } from '@mesapop/shared'
import {
  aplicaDesenhaAction,
  desenhaViewFor,
  initialDesenhaState,
  tickDesenha,
  type DesenhaState,
} from '../src/games/desenha'

function comPalavra(players = 3, palavra = 'suvaco'): DesenhaState {
  const s = initialDesenhaState(players)
  const r = aplicaDesenhaAction(s, 0, { type: 'palavra', palavra })
  if ('error' in r) throw new Error(r.error)
  return r.state
}

describe('Desenha & Adivinha — regras', () => {
  it('só o desenhista escolhe a palavra; escolher inicia o desenho', () => {
    const s = initialDesenhaState(3)
    expect(s.fase).toBe('escolhendo')
    const errado = aplicaDesenhaAction(s, 1, { type: 'palavra', palavra: 'gato' })
    expect('error' in errado).toBe(true)
    const ok = aplicaDesenhaAction(s, 0, { type: 'palavra', palavra: 'gato' })
    expect('error' in ok).toBe(false)
    expect(s.fase).toBe('desenhando')
    expect(s.tempo).toBe(180)
  })

  it('só o desenhista risca e limpa a tela', () => {
    const s = comPalavra()
    const intruso = aplicaDesenhaAction(s, 2, { type: 'traco', color: '#000', size: 4, pts: [1, 2, 3, 4] })
    expect('error' in intruso).toBe(true)
    aplicaDesenhaAction(s, 0, { type: 'traco', color: '#000', size: 4, pts: [1, 2, 3, 4] })
    expect(s.strokes).toHaveLength(1)
    aplicaDesenhaAction(s, 0, { type: 'limpar' })
    expect(s.strokes).toHaveLength(0)
  })

  it('A PALAVRA NUNCA VAZA para quem adivinha (nem no palpite certo)', () => {
    const s = comPalavra(3, 'melancia')
    // palpite certo com acento/maiúsculas diferentes
    aplicaDesenhaAction(s, 1, { type: 'palpite', texto: '  MELANCIA ' })
    const paraAdivinhador = JSON.stringify(desenhaViewFor(s, 2))
    const paraEspectador = JSON.stringify(desenhaViewFor(s, -1))
    expect(paraAdivinhador).not.toContain('melancia')
    expect(paraEspectador).not.toContain('melancia')
    // o desenhista vê a própria palavra
    expect(desenhaViewFor(s, 0).palavra).toBe('melancia')
    // o acerto aparece SEM o texto
    const resposta = desenhaViewFor(s, 2).respostas.at(-1)!
    expect(resposta.acertou).toBe(true)
    expect(resposta.text).toBeNull()
  })

  it('normalização: acento e caixa não impedem o acerto', () => {
    expect(normalizaPalavra('AVIÃO ')).toBe(normalizaPalavra('aviao'))
    const s = comPalavra(3, 'côco gelado')
    aplicaDesenhaAction(s, 1, { type: 'palpite', texto: 'coco   GELADO' })
    expect(s.acertaram).toContain(1)
  })

  it('pontos por ordem de acerto; desenhista também pontua', () => {
    const s = comPalavra(4, 'bola')
    aplicaDesenhaAction(s, 1, { type: 'palpite', texto: 'bola' })
    aplicaDesenhaAction(s, 2, { type: 'palpite', texto: 'bola' })
    expect(s.scores[1]).toBe(100)
    expect(s.scores[2]).toBe(80)
    expect(s.scores[0]).toBe(50) // 25 por acertador
    // quem acertou não palpita de novo
    const dupla = aplicaDesenhaAction(s, 1, { type: 'palpite', texto: 'bola' })
    expect('error' in dupla).toBe(true)
  })

  it('todos acertaram → revelação → próxima rodada com NOVO desenhista', () => {
    const s = comPalavra(3, 'sol')
    aplicaDesenhaAction(s, 1, { type: 'palpite', texto: 'sol' })
    aplicaDesenhaAction(s, 2, { type: 'palpite', texto: 'sol' })
    expect(s.fase).toBe('revelacao')
    // na revelação, a palavra aparece para todos
    expect(desenhaViewFor(s, 1).palavra).toBe('sol')
    tickDesenha(s, 6)
    expect(s.fase).toBe('escolhendo')
    expect(s.rodada).toBe(2)
    expect(s.desenhista).toBe(1)
    expect(s.strokes).toHaveLength(0)
    expect(s.acertaram).toHaveLength(0)
  })

  it('tempo esgotado desenhando → revelação; fim após todas as rodadas', () => {
    const s = comPalavra(3)
    tickDesenha(s, 181)
    expect(s.fase).toBe('revelacao')
    // atropela as rodadas restantes
    let guarda = 0
    while (s.fase !== 'fim' && guarda++ < 50) {
      tickDesenha(s, 200)
    }
    expect(s.fase).toBe('fim')
    expect(s.vencedores.length).toBeGreaterThan(0)
  })

  it('dica: tracinhos preservam espaços e revelam letras aos poucos', () => {
    expect(dicaDe('sol', 0)).toBe('_ _ _')
    expect(dicaDe('bom dia', 0)).toBe('_ _ _   _ _ _')
    const com1 = dicaDe('melancia', 1)
    expect(com1.split(' ').filter((c) => c !== '_' && c !== '').length).toBe(1)
  })

  it('desenhista não palpita; palpite fora da fase é recusado', () => {
    const s = comPalavra()
    const proprio = aplicaDesenhaAction(s, 0, { type: 'palpite', texto: 'suvaco' })
    expect('error' in proprio).toBe(true)
    const antes = initialDesenhaState(3)
    const cedo = aplicaDesenhaAction(antes, 1, { type: 'palpite', texto: 'oi' })
    expect('error' in cedo).toBe(true)
  })
})
