/**
 * Tetos anti-trapaça por jogo solo. O servidor mede a duração e recusa
 * pontuações impossíveis (acima de maxPerSec×duração ou de maxPoints, ou
 * rápidas demais). Compartilhado pelas partidas livres (solo.ts) e pelo
 * Desafio Diário (desafio.ts).
 */
export const PLAUSIBILITY: Record<string, { maxPerSec: number; minMs: number; maxPoints: number }> = {
  'esquadrao-1942': { maxPerSec: 400, minMs: 4000, maxPoints: 2_000_000 },
  'nave-espacial': { maxPerSec: 15, minMs: 3000, maxPoints: 200_000 },
  cardume: { maxPerSec: 80, minMs: 5000, maxPoints: 500_000 },
  snake: { maxPerSec: 30, minMs: 2000, maxPoints: 50_000 },
  'campo-minado': { maxPerSec: 150, minMs: 2500, maxPoints: 2_000 },
  invasores: { maxPerSec: 80, minMs: 4000, maxPoints: 1_000_000 },
  'come-come': { maxPerSec: 120, minMs: 4000, maxPoints: 500_000 },
  'pega-ladrao': { maxPerSec: 100, minMs: 4000, maxPoints: 300_000 },
  'missao-elevador': { maxPerSec: 120, minMs: 5000, maxPoints: 500_000 },
  paciencia: { maxPerSec: 30, minMs: 25000, maxPoints: 2_000 },
  puzzle: { maxPerSec: 80, minMs: 15000, maxPoints: 10_000 },
  memoria: { maxPerSec: 60, minMs: 15000, maxPoints: 2_000 },
  sudoku: { maxPerSec: 60, minMs: 25000, maxPoints: 2_500 },
  'caca-palavras': { maxPerSec: 50, minMs: 20000, maxPoints: 1_500 },
  cruzadinha: { maxPerSec: 40, minMs: 30000, maxPoints: 2_200 },
  mahjong: { maxPerSec: 40, minMs: 20000, maxPoints: 5_000 },
}
