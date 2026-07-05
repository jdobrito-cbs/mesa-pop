/**
 * Catálogo de jogos da plataforma. Fonte única de verdade para o seed do
 * banco e para a UI. `enabled` aqui indica o estado inicial do seed — o
 * estado real (toggle do admin) vive no banco.
 */

export type GameFamily =
  | 'TURN' // cartas e tabuleiro
  | 'PARTY' // gartic-like, dedução social
  | 'PUZZLE' // single-player com leaderboard
  | 'ARCADE' // single-player de reflexo
  | 'ACTION' // 2D top-down em tempo real
  | 'ECONOMY' // fazenda
  | 'FLOCKING' // cardume

export interface GameDef {
  slug: string
  name: string
  description: string
  family: GameFamily
  minPlayers: number
  maxPlayers: number
  /** Cor do card no lobby (token da paleta Mesa Pop). */
  color: string
  /** Emoji usado como ícone até o jogo ter arte própria. */
  icon: string
  /** Fase do roadmap em que o jogo é implementado. */
  phase: number
  /** Habilitado no seed inicial (jogos ainda não implementados nascem ocultos). */
  enabled: boolean
}

export const GAME_CATALOG: GameDef[] = [
  // FASE 2
  { slug: 'damas', name: 'Damas', description: 'O clássico jogo de tabuleiro para dois.', family: 'TURN', minPlayers: 2, maxPlayers: 2, color: 'pop-purple', icon: '⚫', phase: 2, enabled: false },
  // FASE 3
  { slug: 'domino', name: 'Dominó', description: 'Quatro jogadores, em duplas, na mesa.', family: 'TURN', minPlayers: 4, maxPlayers: 4, color: 'pop-cyan', icon: '🁢', phase: 3, enabled: false },
  { slug: 'one', name: 'One', description: 'Descarte tudo antes dos rivais. Cuidado com o +4!', family: 'TURN', minPlayers: 2, maxPlayers: 4, color: 'pop-orange', icon: '🃏', phase: 3, enabled: false },
  // FASE 4
  { slug: 'esquadrao-1942', name: 'Esquadrão 42', description: 'Shoot\'em up aéreo com chuva de power-ups.', family: 'ACTION', minPlayers: 1, maxPlayers: 2, color: 'pop-yellow', icon: '✈️', phase: 4, enabled: false },
  { slug: 'nave-espacial', name: 'Desvio Estelar', description: 'Desvie de tudo. Sobreviva o máximo que puder.', family: 'ARCADE', minPlayers: 1, maxPlayers: 1, color: 'pop-purple', icon: '🚀', phase: 4, enabled: false },
  // FASE 6
  { slug: 'fazenda', name: 'Fazenda Pop', description: 'Plante, colha, venda e cresça — até offline.', family: 'ECONOMY', minPlayers: 1, maxPlayers: 1, color: 'pop-green', icon: '🌾', phase: 6, enabled: false },
  { slug: 'cardume', name: 'Cardume', description: 'Comande um cardume vivo contra peixes gigantes.', family: 'FLOCKING', minPlayers: 1, maxPlayers: 1, color: 'pop-cyan', icon: '🐠', phase: 6, enabled: false },
  // FASE 7
  { slug: 'corrida', name: 'Corrida Pop', description: 'Corrida vista de cima com drift e boost. Até 4.', family: 'ACTION', minPlayers: 2, maxPlayers: 4, color: 'pop-orange', icon: '🏎️', phase: 7, enabled: false },
  // FASE 8
  { slug: 'xadrez', name: 'Xadrez', description: 'O jogo dos reis, em salas ranqueadas.', family: 'TURN', minPlayers: 2, maxPlayers: 2, color: 'pop-purple', icon: '♞', phase: 8, enabled: false },
  { slug: 'truco', name: 'Truco', description: 'Blefe, grite truco e vire a mesa.', family: 'TURN', minPlayers: 2, maxPlayers: 4, color: 'pop-orange', icon: '🂡', phase: 8, enabled: false },
  { slug: 'stop', name: 'Stop!', description: 'Adedanha com os amigos: pense rápido!', family: 'PARTY', minPlayers: 2, maxPlayers: 6, color: 'pop-yellow', icon: '✏️', phase: 8, enabled: false },
  { slug: 'desenha-adivinha', name: 'Desenha & Adivinha', description: 'Desenhe a palavra secreta em 3 min — quem acerta no chat, vence.', family: 'PARTY', minPlayers: 3, maxPlayers: 6, color: 'pop-green', icon: '🎨', phase: 8, enabled: false },
  { slug: 'campo-minado', name: 'Campo Minado', description: 'Lógica pura com desafio diário.', family: 'PUZZLE', minPlayers: 1, maxPlayers: 1, color: 'pop-cyan', icon: '💣', phase: 8, enabled: false },
  { slug: 'termo-diario', name: 'Palavra do Dia', description: 'Uma palavra por dia. Compare com os amigos.', family: 'PUZZLE', minPlayers: 1, maxPlayers: 1, color: 'pop-green', icon: '🔤', phase: 8, enabled: false },
  { slug: 'snake', name: 'Snake', description: 'Coma, cresça, não se morda. Clássico eterno.', family: 'ARCADE', minPlayers: 1, maxPlayers: 1, color: 'pop-green', icon: '🐍', phase: 8, enabled: false },
  { slug: 'paciencia', name: 'Paciência', description: 'O clássico solitário de cartas para relaxar.', family: 'PUZZLE', minPlayers: 1, maxPlayers: 1, color: 'pop-magenta', icon: '🃑', phase: 8, enabled: false },
  { slug: 'puzzle', name: 'Puzzle', description: 'Monte o quebra-cabeça no menor tempo.', family: 'PUZZLE', minPlayers: 1, maxPlayers: 1, color: 'pop-yellow', icon: '🧩', phase: 8, enabled: false },
  { slug: 'missao-elevador', name: 'Missão Elevador', description: 'Desça o prédio de elevador, porta a porta, sem ser visto.', family: 'ARCADE', minPlayers: 1, maxPlayers: 1, color: 'pop-purple', icon: '🛗', phase: 8, enabled: false },
  { slug: 'pega-ladrao', name: 'Pega-Ladrão', description: 'Persiga o ladrão pelos andares da loja antes que ele fuja.', family: 'ARCADE', minPlayers: 1, maxPlayers: 1, color: 'pop-orange', icon: '👮', phase: 8, enabled: false },
  { slug: 'come-come', name: 'Come-Come', description: 'Limpe o labirinto sem virar lanche dos fantasmas.', family: 'ARCADE', minPlayers: 1, maxPlayers: 1, color: 'pop-yellow', icon: '🟡', phase: 8, enabled: false },
]
