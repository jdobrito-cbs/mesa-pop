/**
 * Corrida do Ganso — clássico jogo de trilha (domínio público, séc. XVI).
 * Lógica pura e compartilhada; o servidor sorteia os dados (anti-trapaça) e
 * chama `aplicaRolagem`. 2–4 jogadores; ganha quem chega EXATO na casa 63.
 *
 * Casas especiais:
 * - 🪿 ganso: avança DE NOVO o mesmo valor (encadeia).
 * - 🌉 ponte (6 → 12): atalho.
 * - 🏨 estalagem (19): perde 1 vez.
 * - 🕳️ poço (31): perde 2 vezes.
 * - 🌀 labirinto (42 → 30): recua.
 * - 💀 caveira (58 → 0): volta ao início.
 * Passar de 63 → ricocheteia (63 − excesso).
 */

export const GANSO_FIM = 63

/** casas do ganso: cair nelas faz avançar de novo o mesmo valor */
const GANSOS = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59])

export type GansoEvento = 'ricochete' | 'ganso' | 'ponte' | 'estalagem' | 'poco' | 'labirinto' | 'caveira' | 'chegou'

export type CasaTipo = 'normal' | 'ganso' | 'ponte' | 'estalagem' | 'poco' | 'labirinto' | 'caveira' | 'fim'

export interface CasaInfo {
  tipo: CasaTipo
  destino?: number
}

/** o tipo de cada casa (para o servidor resolver e para a UI desenhar) */
export function casaInfo(pos: number): CasaInfo {
  if (pos === GANSO_FIM) return { tipo: 'fim' }
  if (pos === 6) return { tipo: 'ponte', destino: 12 }
  if (pos === 19) return { tipo: 'estalagem' }
  if (pos === 31) return { tipo: 'poco' }
  if (pos === 42) return { tipo: 'labirinto', destino: 30 }
  if (pos === 58) return { tipo: 'caveira', destino: 0 }
  if (GANSOS.has(pos)) return { tipo: 'ganso' }
  return { tipo: 'normal' }
}

export interface GansoState {
  players: number
  /** casa atual de cada assento (0 = largada) */
  positions: number[]
  /** vezes a perder de cada assento (estalagem/poço) */
  skip: number[]
  turn: number
  /** último par de dados (para a UI mostrar) */
  lastRoll: [number, number] | null
  /** resumo do último lance (animação + narração) */
  lastMove: { seat: number; from: number; to: number; roll: number; eventos: GansoEvento[] } | null
  winner: number | null
}

export function initialGansoState(players: number): GansoState {
  return {
    players,
    positions: Array(players).fill(0),
    skip: Array(players).fill(0),
    turn: 0,
    lastRoll: null,
    lastMove: null,
    winner: null,
  }
}

/** resolve o destino de um lance (com ricochete, ganso encadeado e especiais) */
function resolveDestino(from: number, roll: number): { to: number; eventos: GansoEvento[]; skip: number } {
  const eventos: GansoEvento[] = []
  let pos = from + roll
  let skip = 0
  for (let i = 0; i < 24; i++) {
    if (pos > GANSO_FIM) {
      pos = GANSO_FIM - (pos - GANSO_FIM)
      eventos.push('ricochete')
    }
    const info = casaInfo(pos)
    if (info.tipo === 'ganso') {
      eventos.push('ganso')
      pos += roll
      continue
    }
    if (info.tipo === 'ponte') {
      eventos.push('ponte')
      pos = info.destino!
      break
    }
    if (info.tipo === 'labirinto') {
      eventos.push('labirinto')
      pos = info.destino!
      break
    }
    if (info.tipo === 'caveira') {
      eventos.push('caveira')
      pos = info.destino!
      break
    }
    if (info.tipo === 'estalagem') {
      eventos.push('estalagem')
      skip = 1
      break
    }
    if (info.tipo === 'poco') {
      eventos.push('poco')
      skip = 2
      break
    }
    break
  }
  if (pos === GANSO_FIM) eventos.push('chegou')
  return { to: pos, eventos, skip }
}

/** próximo assento a jogar, pulando quem está de castigo (consome o skip) */
function proximoTurno(positions: number[], skip: number[], atual: number, players: number): number {
  let t = atual
  for (let i = 0; i < players * 3; i++) {
    t = (t + 1) % players
    if (skip[t]! > 0) {
      skip[t]! -= 1
      continue
    }
    return t
  }
  return (atual + 1) % players
}

/**
 * Aplica um lance do assento da vez com os dados JÁ sorteados pelo servidor.
 * Retorna erro ou o novo estado.
 */
export function aplicaRolagem(
  state: GansoState,
  seat: number,
  dados: [number, number],
): { error: string } | { state: GansoState } {
  if (state.winner !== null) return { error: 'A partida já terminou' }
  if (state.turn !== seat) return { error: 'Não é a sua vez' }
  const [d1, d2] = dados
  if (![1, 2, 3, 4, 5, 6].includes(d1) || ![1, 2, 3, 4, 5, 6].includes(d2)) {
    return { error: 'Dados inválidos' }
  }

  const roll = d1 + d2
  const from = state.positions[seat]!
  const { to, eventos, skip } = resolveDestino(from, roll)

  const positions = state.positions.slice()
  positions[seat] = to
  const skips = state.skip.slice()
  skips[seat] = skip

  const winner = to === GANSO_FIM ? seat : null
  const turn = winner !== null ? state.turn : proximoTurno(positions, skips, seat, state.players)

  return {
    state: {
      ...state,
      positions,
      skip: skips,
      turn,
      lastRoll: [d1, d2],
      lastMove: { seat, from, to, roll, eventos },
      winner,
    },
  }
}
