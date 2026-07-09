/**
 * Interface que TODO jogo da plataforma implementa para plugar no
 * RoomManager. O servidor é autoritativo: `play` valida cada ação.
 */
export interface GameModule<S = unknown, A = unknown> {
  slug: string
  minPlayers: number
  maxPlayers: number
  /** contagens EXATAS aceitas (ex.: truco = [2, 4]); ausente = min..max */
  validPlayerCounts?: number[]
  /** jogadores escolhem assento/dupla na sala de espera */
  seatPicking?: boolean
  /** sala aceita espectadores (getStateFor recebe seat -1) */
  allowSpectators?: boolean
  /** dupla perdedora sai para a fila; próxima entra; vencedores ficam */
  rotation?: boolean
  /**
   * jogo em TEMPO REAL: o manager roda tick() a cada tickMs e transmite o
   * snapshot a cada `broadcastEvery` ticks. Ações não são retransmitidas
   * individualmente. `perSeatView` = getStateFor filtra por assento (mão
   * escondida) e NÃO usa eventos consumíveis — cada jogador recebe a sua
   * visão (Desenha & Adivinha, Duelo, Stop). Sem a flag, um snapshot
   * único é enviado a todos (co-op, corrida — eventos consumidos 1×).
   */
  realtime?: { tickMs: number; broadcastEvery: number; perSeatView?: boolean }
  /** estado inicial para N jogadores (opções vêm da criação da sala) */
  init(playerCount: number, options?: Record<string, unknown>): S
  /** valida e aplica a ação do seat; retorna erro OU novo estado */
  play(state: S, seat: number, action: A): { error: string } | { state: S }
  /** visão do estado para um seat (jogos de mão escondida filtram aqui) */
  getStateFor(state: S, seat: number): unknown
  /** avança a simulação (apenas jogos realtime) */
  tick?(state: S, dt: number): void
  /**
   * IA (opcional): assento cujo é a vez AGORA (jogos de turno). null = fim
   * ou nenhum assento específico. O manager usa isto para saber se o próximo
   * a jogar é um robô. Ausente = jogo sem suporte a bot.
   */
  currentSeat?(state: S): number | null
  /**
   * IA (opcional): a ação que o robô joga no seu assento. Recebe o estado
   * COMPLETO (roda no servidor); jogos de mão escondida devem olhar apenas
   * a própria mão. null = sem jogada possível.
   */
  bot?(state: S, seat: number): A | null
  /**
   * atraso do "pensar" do robô neste jogo (ms). Ausente = padrão do manager.
   * Jogos com animação longa entre a jogada e a resposta (ex.: a roleta do
   * Gira Gênio girando 3s) aumentam isto para o robô não responder antes.
   */
  botDelayMs?: number
  /**
   * IA para jogos REALTIME (opcional): chamado a cada tick com os assentos
   * controlados por robô — o módulo age por eles direto no estado (ex.: o
   * quiz responde as perguntas pelos bots).
   */
  botTick?(state: S, botSeats: number[], dt: number): void
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
