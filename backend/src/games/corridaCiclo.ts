/**
 * Ciclo genérico de "corrida com apostas" — a infraestrutura comum do
 * Páreo (cavalos) e do Cisco (galinhas): fases por SALA movidas a
 * timestamps oficiais do servidor (apostas → pré-largada → corrida
 * encurtada ao cruzamento → cerimônia que absorve o resto), seed oculta
 * até a largada e jogo contínuo. Só a SIMULAÇÃO muda entre os jogos.
 */
import crypto from 'node:crypto'

export type CorridaFase = 'apostas' | 'prelargada' | 'corrida' | 'cerimonia'

export interface CorridaState {
  numero: number
  fase: CorridaFase
  faseFimEm: number
  largadaEm: number
  seed: number
  vencedor: number
  /** fração 0..1 em que o vencedor cruza (encurta a fase de corrida) */
  winCrossT: number
  historico: string[]
}

export interface CorridaConfig {
  /** durações oficiais das fases (ms) */
  apostasMs: number
  prelargadaMs: number
  corridaMs: number
  cerimoniaMs: number
  /** folga após o cruzamento antes de anunciar (ms) */
  caudaMs: number
  /** resolve o vencedor e o instante do cruzamento a partir da seed */
  resultadoDe(seed: number): { vencedor: number; winCrossT: number }
  /** nome do competidor da raia (para o histórico) */
  nomeDe(lane: number): string
}

/** duração efetiva da fase de corrida: até o vencedor cruzar + folga */
function corridaMsDe(cfg: CorridaConfig, winCrossT: number): number {
  return Math.min(cfg.corridaMs, Math.round(winCrossT * cfg.corridaMs) + cfg.caudaMs)
}

/** prepara uma nova corrida a partir de `agora` (fase de apostas) */
export function novaCorrida(
  cfg: CorridaConfig,
  numero: number,
  historico: string[],
  agora = Date.now(),
): CorridaState {
  const seed = crypto.randomInt(1, 2147483646)
  const r = cfg.resultadoDe(seed)
  return {
    numero,
    fase: 'apostas',
    faseFimEm: agora + cfg.apostasMs,
    largadaEm: agora + cfg.apostasMs + cfg.prelargadaMs,
    seed,
    vencedor: r.vencedor,
    winCrossT: r.winCrossT,
    historico,
  }
}

/** avança o ciclo pelas horas OFICIAIS do servidor (tick realtime) */
export function avancaCicloCorrida(cfg: CorridaConfig, s: CorridaState, agora = Date.now()): void {
  // laço: se o servidor ficou um tempo sem tick, atravessa as fases devidas
  while (agora >= s.faseFimEm) {
    if (s.fase === 'apostas') {
      s.fase = 'prelargada'
      s.faseFimEm = s.largadaEm
    } else if (s.fase === 'prelargada') {
      s.fase = 'corrida'
      s.faseFimEm = s.largadaEm + corridaMsDe(cfg, s.winCrossT)
    } else if (s.fase === 'corrida') {
      s.fase = 'cerimonia'
      // a cerimônia absorve o resto do ciclo (total constante)
      s.faseFimEm = s.largadaEm + cfg.corridaMs + cfg.cerimoniaMs
      s.historico = [cfg.nomeDe(s.vencedor), ...s.historico].slice(0, 8)
    } else {
      // cerimônia terminou → próxima corrida começa NA HORA
      const prox = novaCorrida(cfg, s.numero + 1, s.historico, s.faseFimEm)
      Object.assign(s, prox)
    }
  }
}

/** visão comum — a seed (e o vencedor) só saem do servidor na hora certa */
export function viewDeCorrida(s: CorridaState) {
  return {
    numero: s.numero,
    fase: s.fase,
    faseFimEm: s.faseFimEm,
    largadaEm: s.largadaEm,
    agora: Date.now(),
    seed: s.fase === 'corrida' || s.fase === 'cerimonia' ? s.seed : null,
    vencedor: s.fase === 'cerimonia' ? s.vencedor : null,
    historico: s.historico,
  }
}
