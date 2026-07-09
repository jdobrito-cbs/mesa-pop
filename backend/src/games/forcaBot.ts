import type { ForcaAction } from '@mesapop/shared'
import type { ForcaState } from './forca'

/**
 * Bot da Forca — nível equilibrado. Como ESCOLHEDOR, sorteia uma palavra de um
 * banco. Como adivinhador, chuta por FREQUÊNCIA de letras do português (não
 * espia a palavra secreta).
 */

const PALAVRAS = [
  'banana', 'cachorro', 'computador', 'girafa', 'janela', 'musica', 'pipoca', 'relogio',
  'sorvete', 'tartaruga', 'ventilador', 'abacaxi', 'bicicleta', 'chocolate', 'elefante',
  'foguete', 'guitarra', 'montanha', 'oceano', 'sanfona', 'foguetes', 'castelo', 'estrela',
]
const FREQ = 'AEOSRINDMUTCLPVGHQBFZJXKW'.split('')

export function chooseForcaMove(s: ForcaState, seat: number): ForcaAction | null {
  if (s.fase === 'fim') return null

  if (s.fase === 'escolhendo') {
    if (seat !== s.escolhedor) return null
    return { type: 'palavra', palavra: PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)]! }
  }

  // jogando: só o adivinhador da vez
  if (seat !== s.turno || seat === s.escolhedor) return null
  const tentadas = new Set([...s.letrasCertas, ...s.letrasErradas])
  const letra = FREQ.find((l) => !tentadas.has(l))
  return { type: 'letra', letra: letra ?? 'A' }
}
