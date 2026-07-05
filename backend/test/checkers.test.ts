import { describe, expect, it } from 'vitest'
import {
  applyMove,
  findMove,
  initialCheckersState,
  isDark,
  legalMoves,
  type CheckersState,
  type Piece,
} from '@mesapop/shared'

/** monta um estado a partir de um mapa {índice: peça} */
function stateWith(pieces: Record<number, Piece>, turn: 0 | 1 = 0): CheckersState {
  const board = Array<Piece | null>(64).fill(null)
  for (const [idx, piece] of Object.entries(pieces)) board[Number(idx)] = piece
  return { board, turn, chainFrom: null, quietMoves: 0, winner: null, draw: false }
}

// índices úteis (linha*8+coluna, linha 0 no topo; escuras têm (r+c) ímpar)
const at = (r: number, c: number) => r * 8 + c

describe('estado inicial', () => {
  it('tem 12 peças por lado, todas em casas escuras', () => {
    const s = initialCheckersState()
    const p0 = s.board.filter((p) => p?.p === 0).length
    const p1 = s.board.filter((p) => p?.p === 1).length
    expect(p0).toBe(12)
    expect(p1).toBe(12)
    s.board.forEach((p, i) => {
      if (p) expect(isDark(i)).toBe(true)
    })
  })

  it('jogador 0 começa com 7 lances possíveis', () => {
    // 4 peças na linha 5, movendo para linha 4: 7 destinos livres
    expect(legalMoves(initialCheckersState())).toHaveLength(7)
  })
})

describe('movimento de peão', () => {
  it('peão move só para frente quando não há captura', () => {
    const s = stateWith({ [at(4, 3)]: { p: 0, k: false } })
    const moves = legalMoves(s)
    expect(moves.map((m) => m.to).sort()).toEqual([at(3, 2), at(3, 4)].sort())
  })

  it('peão captura para trás (regra brasileira)', () => {
    const s = stateWith({
      [at(3, 2)]: { p: 0, k: false },
      [at(4, 3)]: { p: 1, k: false }, // atrás do peão 0
    })
    const moves = legalMoves(s)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.captures).toEqual([at(4, 3)])
    expect(moves[0]!.to).toBe(at(5, 4))
  })
})

describe('captura obrigatória e lei da maioria', () => {
  it('havendo captura, lances simples somem', () => {
    const s = stateWith({
      [at(5, 2)]: { p: 0, k: false },
      [at(4, 3)]: { p: 1, k: false },
    })
    const moves = legalMoves(s)
    expect(moves.every((m) => m.captures.length > 0)).toBe(true)
  })

  it('escolhe a cadeia com MAIS capturas (maioria)', () => {
    // peça 0 em (5,2): à esquerda captura 1; à direita cadeia dupla
    const s = stateWith({
      [at(5, 2)]: { p: 0, k: false },
      [at(4, 1)]: { p: 1, k: false }, // captura simples
      [at(4, 3)]: { p: 1, k: false }, // início da dupla
      [at(2, 5)]: { p: 1, k: false }, // segunda da dupla
    })
    const moves = legalMoves(s)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.captures).toHaveLength(2)
    expect(moves[0]!.to).toBe(at(1, 6))
  })

  it('peça capturada não pode ser saltada duas vezes', () => {
    // diamante em volta de (3,4): o peão em (5,4) fecha o círculo capturando
    // as 4 e voltando ao início — sem a regra, a cadeia seria infinita
    const s = stateWith({
      [at(5, 4)]: { p: 0, k: false },
      [at(4, 3)]: { p: 1, k: false },
      [at(2, 3)]: { p: 1, k: false },
      [at(2, 5)]: { p: 1, k: false },
      [at(4, 5)]: { p: 1, k: false },
    })
    const moves = legalMoves(s)
    expect(Math.max(...moves.map((m) => m.captures.length))).toBe(4)
  })
})

describe('dama (rei)', () => {
  it('dama voa a qualquer distância', () => {
    const s = stateWith({ [at(4, 3)]: { p: 0, k: true } })
    const moves = legalMoves(s)
    // diagonais completas a partir de (4,3): 4+3+3+3 = 13 casas
    expect(moves).toHaveLength(13)
  })

  it('dama captura à distância e pousa em qualquer casa após a peça', () => {
    const s = stateWith({
      [at(7, 0)]: { p: 0, k: true },
      [at(4, 3)]: { p: 1, k: false },
    })
    const moves = legalMoves(s)
    expect(moves.every((m) => m.captures.length === 1)).toBe(true)
    const landings = moves.map((m) => m.to).sort()
    expect(landings).toEqual([at(3, 4), at(2, 5), at(1, 6), at(0, 7)].sort())
  })
})

describe('promoção', () => {
  it('peão vira dama ao PARAR na última fileira', () => {
    const s = stateWith({ [at(1, 2)]: { p: 0, k: false } })
    const move = findMove(s, at(1, 2), at(0, 1))!
    const next = applyMove(s, move)
    expect(next.board[at(0, 1)]).toEqual({ p: 0, k: true })
  })

  it('NÃO promove passando pela última fileira no meio de cadeia', () => {
    // captura entra na linha 0 e continua: segue peão
    const s = stateWith({
      [at(2, 1)]: { p: 0, k: false },
      [at(1, 2)]: { p: 1, k: false },
      [at(1, 4)]: { p: 1, k: false },
    })
    const moves = legalMoves(s)
    const best = moves.find((m) => m.captures.length === 2)!
    const next = applyMove(s, best)
    // pousou em (2,5) — continua peão
    expect(next.board[best.to]).toEqual({ p: 0, k: false })
  })
})

describe('fim de jogo', () => {
  it('vence quem deixa o adversário sem peças', () => {
    const s = stateWith({
      [at(5, 2)]: { p: 0, k: false },
      [at(4, 3)]: { p: 1, k: false },
    })
    const next = applyMove(s, legalMoves(s)[0]!)
    expect(next.winner).toBe(0)
  })

  it('vence quem deixa o adversário sem lances (bloqueio)', () => {
    // peça 1 no canto (0,7)=7... canto escuro: (0,7)? (0+7)%2=1 escuro. peça 1 em (0,7)
    // bloqueada por peças 0 em (1,6) e (2,5), com (2,7) ocupada por 0 também.
    const s = stateWith(
      {
        [at(0, 7)]: { p: 1, k: false },
        [at(1, 6)]: { p: 0, k: false },
        [at(2, 5)]: { p: 0, k: false },
        [at(2, 7)]: { p: 0, k: false },
        [at(7, 0)]: { p: 0, k: false },
      },
      0,
    )
    // 0 joga um lance qualquer que não abra captura para 1
    const move = findMove(s, at(7, 0), at(6, 1))!
    const next = applyMove(s, move)
    expect(next.winner).toBe(0)
  })

  it('empata após 40 lances de dama sem progresso', () => {
    let s = stateWith(
      {
        [at(7, 0)]: { p: 0, k: true },
        [at(0, 7)]: { p: 1, k: true },
      },
      0,
    )
    s = { ...s, quietMoves: 39 }
    const move = legalMoves(s).find((m) => m.captures.length === 0)!
    const next = applyMove(s, move)
    expect(next.draw).toBe(true)
    expect(next.winner).toBeNull()
  })
})
