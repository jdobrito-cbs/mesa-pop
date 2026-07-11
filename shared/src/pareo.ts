/**
 * Páreo (O "Corre" do Yvens) — corrida de cavalos com apostas.
 * Simulação DETERMINÍSTICA portada do protótipo aprovado: a timeline
 * inteira é pré-computada a partir da seed, então servidor e todos os
 * clientes reproduzem exatamente a MESMA corrida (vencedor visual ==
 * vencedor real). O servidor é dono do ciclo, da seed e do resultado.
 */

export interface PareoCavaloDef {
  nome: string
  cor: string
  /** favoritismo (probabilidade relativa de vitória) */
  peso: number
}

export const PAREO_CAVALOS: PareoCavaloDef[] = [
  { nome: 'Trovão', cor: '#e0563f', peso: 0.34 },
  { nome: 'Relâmpago', cor: '#4aa3df', peso: 0.28 },
  { nome: 'Aurora', cor: '#e8c34a', peso: 0.22 },
  { nome: 'Corcel', cor: '#8d7ae0', peso: 0.16 },
]

/** margem da banca embutida nas odds */
export const PAREO_HOUSE_EDGE = 0.88
export const PAREO_APOSTAS_FICHAS = [10, 25, 50, 100, 250]

/** durações das fases do ciclo (total = 180s) */
export const PAREO_APOSTAS_MS = 123_000
export const PAREO_PRELARGADA_MS = 30_000
export const PAREO_CORRIDA_MS = 20_000
export const PAREO_CERIMONIA_MS = 7_000
/** folga após o vencedor cruzar, antes de anunciar (o cavalo passa a linha) */
export const PAREO_CAUDA_MS = 1_100

export type PareoFase = 'apostas' | 'prelargada' | 'corrida' | 'cerimonia'

/** odds fixas por raia (1/prob × margem, piso 1.2) */
export function pareoOdds(): number[] {
  const total = PAREO_CAVALOS.reduce((s, h) => s + h.peso, 0)
  return PAREO_CAVALOS.map(
    (h) => Math.round(Math.max(1.2, (1 / (h.peso / total)) * PAREO_HOUSE_EDGE) * 10) / 10,
  )
}
export const PAREO_ODDS = pareoOdds()

// ——— geometria da pista (compartilhada com o canvas do cliente) ———
export const PAREO_TRACK_LEN = 9400
export const PAREO_FINISH = 8580
export const PAREO_SIM_STEPS = 600
const SIM_DT = PAREO_CORRIDA_MS / 1000 / PAREO_SIM_STEPS

/** PRNG determinístico (Park–Miller) — mesma seed = mesma corrida */
export function pareoRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

interface FaseOrganica {
  amp: number
  freq: number
  off: number
}

export interface PareoCavalo extends PareoCavaloDef {
  lane: number
  odds: number
  skill: number
  formOfDay: number
  fases: FaseOrganica[]
  /** posição na pista por passo da timeline (0..SIM_STEPS) */
  traj: Float32Array
  /** fase do galope por passo (animação das pernas) */
  legTraj: Float32Array
}

export interface PareoCorrida {
  seed: number
  vencedor: number
  /** ordem de chegada (raias) */
  ordem: number[]
  cavalos: PareoCavalo[]
  /** fração 0..1 da corrida em que o vencedor cruza a linha */
  winCrossT: number
}

/** velocidade orgânica (ondas senoidais + arrancada final) */
export function pareoOrganicSpeed(c: PareoCavalo, t: number): number {
  let s = c.skill * c.formOfDay
  for (const p of c.fases) s += p.amp * Math.sin(p.freq * t * Math.PI * 2 + p.off)
  s += 0.06 * Math.sin(t * Math.PI) + 0.08 * Math.pow(t, 3)
  return Math.max(0.35, s)
}

/**
 * Constrói a corrida inteira a partir da seed e PRÉ-COMPUTA a trajetória:
 * a posição em qualquer instante é reproduzível — quem entra no meio vê o
 * estado correto, e o vencedor é detectado pelo cruzamento interpolado.
 */
export function pareoBuildRace(seed: number): PareoCorrida {
  const rng = pareoRandom((seed * 2654435761) >>> 0)
  const totalW = PAREO_CAVALOS.reduce((s, h) => s + h.peso, 0)
  const cavalos: PareoCavalo[] = PAREO_CAVALOS.map((def, i) => {
    const fases: FaseOrganica[] = []
    for (let k = 0; k < 4; k++) {
      fases.push({ amp: 0.1 + rng() * 0.16, freq: 0.7 + rng() * 2.0, off: rng() * Math.PI * 2 })
    }
    const prob = def.peso / totalW
    // habilidade e forma próximas entre si → corridas cabeça a cabeça;
    // o favoritismo influencia, mas com margem pequena
    return {
      ...def,
      lane: i,
      fases,
      skill: 0.94 + prob * 0.28,
      formOfDay: 0.95 + rng() * 0.1,
      odds: PAREO_ODDS[i]!,
      traj: new Float32Array(PAREO_SIM_STEPS + 1),
      legTraj: new Float32Array(PAREO_SIM_STEPS + 1),
    }
  })

  // integra a timeline completa (todos correm até o fim; vencedor = 1º a cruzar)
  let vencedor: number | null = null
  const ordem: number[] = []
  const x = cavalos.map(() => 0)
  const legAcc = cavalos.map(() => 0)
  const crossStep = cavalos.map<number | null>(() => null)
  for (let s = 0; s <= PAREO_SIM_STEPS; s++) {
    const t = s / PAREO_SIM_STEPS
    cavalos.forEach((c, i) => {
      c.traj[s] = x[i]!
      c.legTraj[s] = legAcc[i]!
    })
    // cruzamentos NESTE passo, com fração interpolada para desempate fino
    const cruzaram: Array<{ i: number; cross: number }> = []
    cavalos.forEach((_, i) => {
      if (crossStep[i] === null && x[i]! >= PAREO_FINISH) {
        const prev = s > 0 ? cavalos[i]!.traj[s - 1]! : 0
        const frac = x[i]! - prev > 0 ? (PAREO_FINISH - prev) / (x[i]! - prev) : 0
        cruzaram.push({ i, cross: s - 1 + frac })
      }
    })
    if (cruzaram.length) {
      cruzaram.sort((a, b) => a.cross - b.cross)
      cruzaram.forEach(({ i }) => {
        crossStep[i] = s
        ordem.push(i)
        if (vencedor === null) vencedor = i
      })
    }
    // avança todos (inclusive quem já cruzou — ninguém congela na pista)
    cavalos.forEach((c, i) => {
      const sp = pareoOrganicSpeed(c, t)
      x[i]! += sp * (PAREO_TRACK_LEN / (PAREO_CORRIDA_MS / 1000)) * SIM_DT
      legAcc[i]! += sp * SIM_DT * 12
    })
  }
  if (vencedor === null) {
    let best = 0
    for (let i = 1; i < cavalos.length; i++) if (x[i]! > x[best]!) best = i
    vencedor = best
  }
  cavalos
    .map((_, i) => i)
    .sort((a, b) => x[b]! - x[a]!)
    .forEach((i) => {
      if (!ordem.includes(i)) ordem.push(i)
    })

  // instante (0..1) em que o VENCEDOR cruza — para anunciar logo depois
  const w = cavalos[vencedor]!
  let winCrossT = 1
  for (let s = 0; s <= PAREO_SIM_STEPS; s++) {
    if (w.traj[s]! >= PAREO_FINISH) {
      const prev = s > 0 ? w.traj[s - 1]! : 0
      const frac = w.traj[s]! - prev > 0 ? (PAREO_FINISH - prev) / (w.traj[s]! - prev) : 0
      winCrossT = (s - 1 + frac) / PAREO_SIM_STEPS
      break
    }
  }
  return { seed, vencedor, ordem, cavalos, winCrossT }
}

/** posição/animação de um cavalo num tempo t (0..1) da corrida */
export function pareoHorseAt(c: PareoCavalo, t: number): { x: number; legT: number } {
  const f = Math.max(0, Math.min(1, t)) * PAREO_SIM_STEPS
  const i = Math.floor(f)
  const frac = f - i
  const a = c.traj[i]!
  const b = c.traj[Math.min(PAREO_SIM_STEPS, i + 1)]!
  const la = c.legTraj[i]!
  const lb = c.legTraj[Math.min(PAREO_SIM_STEPS, i + 1)]!
  return { x: a + (b - a) * frac, legT: la + (lb - la) * frac }
}

/** visão do cliente — a seed SÓ aparece a partir da largada (apostas fechadas) */
export interface PareoView {
  /** número do páreo nesta sala (1º, 2º, …) */
  numero: number
  fase: PareoFase
  /** timestamp (servidor) em que a fase atual termina */
  faseFimEm: number
  /** timestamp (servidor) da largada deste páreo */
  largadaEm: number
  /** relógio do servidor no envio — o cliente calcula o offset local */
  agora: number
  /** seed da corrida — null até a largada (o resultado já está fixado) */
  seed: number | null
  /** raia vencedora — só na cerimônia */
  vencedor: number | null
  /** nomes dos últimos vencedores (mais recente primeiro) */
  historico: string[]
}
