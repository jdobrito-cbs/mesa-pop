/**
 * Interface que TODO jogo da plataforma implementa para plugar no
 * RoomManager. O servidor é autoritativo: `play` valida cada ação.
 */
export interface GameModule<S = unknown, A = unknown> {
  slug: string
  minPlayers: number
  maxPlayers: number
  /** jogadores escolhem assento/dupla na sala de espera */
  seatPicking?: boolean
  /** sala aceita espectadores (getStateFor recebe seat -1) */
  allowSpectators?: boolean
  /** dupla perdedora sai para a fila; próxima entra; vencedores ficam */
  rotation?: boolean
  /**
   * jogo em TEMPO REAL: o manager roda tick() a cada tickMs e transmite o
   * snapshot a cada `broadcastEvery` ticks. Ações não são retransmitidas
   * individualmente.
   */
  realtime?: { tickMs: number; broadcastEvery: number }
  /** estado inicial para N jogadores (opções vêm da criação da sala) */
  init(playerCount: number, options?: Record<string, unknown>): S
  /** valida e aplica a ação do seat; retorna erro OU novo estado */
  play(state: S, seat: number, action: A): { error: string } | { state: S }
  /** visão do estado para um seat (jogos de mão escondida filtram aqui) */
  getStateFor(state: S, seat: number): unknown
  /** avança a simulação (apenas jogos realtime) */
  tick?(state: S, dt: number): void
  /** pontuação final por assento (gravada em MatchPlayer.score) */
  scoresFor?(state: S): number[]
  /** resultado atual da partida (winnerSeats > 1 em jogos de dupla) */
  result(state: S): { finished: boolean; winnerSeats: number[]; draw: boolean }
}

const registry = new Map<string, GameModule>()

export function registerGame(module: GameModule) {
  registry.set(module.slug, module)
}

export function getGameModule(slug: string): GameModule | undefined {
  return registry.get(slug)
}
