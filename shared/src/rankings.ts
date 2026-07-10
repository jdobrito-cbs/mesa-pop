/** Rankings GERAIS da plataforma (todas as partidas, todos os jogos). */
export interface RankingGeralRow {
  rank: number
  userId: string
  displayName: string
  avatar: string | null
  /** pontos totais OU tempo total em ms, conforme o ranking */
  valor: number
}

export interface RankingsGerais {
  pontos: RankingGeralRow[]
  tempo: RankingGeralRow[]
  /** posição do usuário logado (null = ainda sem partidas) */
  voce: { pontos: number | null; tempo: number | null } | null
}
