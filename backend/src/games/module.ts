/**
 * Interface que TODO jogo da plataforma implementa para plugar no
 * RoomManager. O servidor é autoritativo: `play` valida cada ação.
 */
export interface GameModule<S = unknown, A = unknown> {
  slug: string
  minPlayers: number
  maxPlayers: number
  /** estado inicial para N jogadores (seat 0..N-1) */
  init(playerCount: number): S
  /** valida e aplica a ação do seat; retorna erro OU novo estado */
  play(state: S, seat: number, action: A): { error: string } | { state: S }
  /** visão do estado para um seat (jogos de mão escondida filtram aqui) */
  getStateFor(state: S, seat: number): unknown
  /** resultado atual da partida */
  result(state: S): { finished: boolean; winnerSeat: number | null; draw: boolean }
}

const registry = new Map<string, GameModule>()

export function registerGame(module: GameModule) {
  registry.set(module.slug, module)
}

export function getGameModule(slug: string): GameModule | undefined {
  return registry.get(slug)
}
