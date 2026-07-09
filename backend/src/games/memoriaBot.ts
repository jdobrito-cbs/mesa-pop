import type { MemoriaAction } from '@mesapop/shared'
import type { MemoriaState } from './memoria'

/**
 * Bot da Memória — nível equilibrado. Só usa o que JÁ FOI REVELADO (o mapa
 * público `vistas`), nunca as cartas ocultas: lembra ~82% das vezes (às vezes
 * "esquece" e vira uma carta nova, como um humano).
 */

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!

export function chooseMemoriaMove(s: MemoriaState, seat: number): MemoriaAction | null {
  if (s.fim || s.turno !== seat) return null
  const disponiveis = s.valores.map((_, i) => i).filter((i) => s.donos[i] === -1 && !s.viradas.includes(i))
  if (disponiveis.length === 0) return null
  const lembra = Math.random() < 0.82

  if (s.viradas.length === 0) {
    // procura um par CONHECIDO (dois na mesa com o mesmo valor já visto)
    if (lembra) {
      const porValor = new Map<number, number[]>()
      for (const i of disponiveis) {
        const v = s.vistas[i]
        if (v === undefined) continue
        const lista = porValor.get(v) ?? []
        lista.push(i)
        porValor.set(v, lista)
      }
      for (const lista of porValor.values()) {
        if (lista.length >= 2) return { type: 'virar', index: lista[0]! }
      }
    }
    // senão, revela uma carta NOVA (ganha informação)
    const novas = disponiveis.filter((i) => s.vistas[i] === undefined)
    return { type: 'virar', index: pick(novas.length ? novas : disponiveis) }
  }

  // segunda carta: tenta completar o par da primeira (que está virada = pública)
  const a = s.viradas[0]!
  const va = s.valores[a]!
  if (lembra) {
    const par = disponiveis.find((i) => i !== a && s.vistas[i] === va)
    if (par !== undefined) return { type: 'virar', index: par }
  }
  const novas = disponiveis.filter((i) => s.vistas[i] === undefined)
  return { type: 'virar', index: pick(novas.length ? novas : disponiveis) }
}
