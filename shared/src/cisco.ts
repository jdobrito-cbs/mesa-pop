/**
 * Cisco (Fazenda do Bruno) — corrida de GALINHAS com apostas, a versão
 * cômica do Páreo. Simulação determinística portada do protótipo
 * aprovado: cada galinha alterna entre CORRER e CISCAR (parar para bicar
 * o chão) por tempos aleatórios — o padrão de ciscadas decide a corrida.
 * As galinhas botam OVOS pelo caminho (efeito visual). Mesma seed =
 * mesmas ciscadas, mesmos ovos, mesma vencedora, para todos.
 */

export interface CiscoGalinhaDef {
  nome: string
  cor: string
  /** favoritismo: corre mais e cisca menos */
  peso: number
}

export const CISCO_GALINHAS: CiscoGalinhaDef[] = [
  { nome: 'Cocota', cor: '#e8543f', peso: 0.34 },
  { nome: 'Penosa', cor: '#f0f0e8', peso: 0.28 },
  { nome: 'Ryca', cor: '#e8b34a', peso: 0.22 },
  { nome: 'Turbina', cor: '#9a6a4a', peso: 0.16 },
]

export const CISCO_HOUSE_EDGE = 0.88
export const CISCO_APOSTAS_FICHAS = [10, 25, 50, 100, 250]

/** durações das fases do ciclo (idênticas ao Páreo; total ~180s) */
export const CISCO_APOSTAS_MS = 123_000
export const CISCO_PRELARGADA_MS = 30_000
export const CISCO_CORRIDA_MS = 20_000
export const CISCO_CERIMONIA_MS = 7_000
export const CISCO_CAUDA_MS = 1_100

export type CiscoFase = 'apostas' | 'prelargada' | 'corrida' | 'cerimonia'

export function ciscoOdds(): number[] {
  const total = CISCO_GALINHAS.reduce((s, g) => s + g.peso, 0)
  return CISCO_GALINHAS.map(
    (g) => Math.round(Math.max(1.2, (1 / (g.peso / total)) * CISCO_HOUSE_EDGE) * 10) / 10,
  )
}
export const CISCO_ODDS = ciscoOdds()

// ——— geometria da pista (compartilhada com o canvas do cliente) ———
export const CISCO_TRACK_LEN = 10800
export const CISCO_FINISH = 9520
export const CISCO_SIM_STEPS = 600
const SIM_DT = CISCO_CORRIDA_MS / 1000 / CISCO_SIM_STEPS

/** PRNG determinístico (Park–Miller) — mesma seed = mesma corrida */
export function ciscoRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export interface CiscoOvo {
  /** posição na pista onde o ovo foi botado */
  x: number
  /** passo da timeline em que surge (para o efeito "plim") */
  step: number
}

export interface CiscoGalinha extends CiscoGalinhaDef {
  lane: number
  odds: number
  /** velocidade quando corre */
  runSpeed: number
  /** probabilidade de começar a ciscar por passo */
  peckChance: number
  peckMin: number
  peckMax: number
  /** posição por passo da timeline */
  traj: Float32Array
  /** 1 = ciscando, 0 = correndo, por passo */
  stateTraj: Uint8Array
  /** fase da passada (animação das pernas) */
  legTraj: Float32Array
  ovos: CiscoOvo[]
}

export interface CiscoCorrida {
  seed: number
  vencedor: number
  ordem: number[]
  galinhas: CiscoGalinha[]
  /** fração 0..1 em que a vencedora cruza a linha */
  winCrossT: number
}

/**
 * Constrói a corrida inteira a partir da seed e PRÉ-COMPUTA a timeline:
 * a cada passo cada galinha CORRE ou CISCA; quem cisca fica parada. O
 * favoritismo dá mais velocidade e menos ciscadas — mas o sorteio das
 * paradas cria as viradas cômicas. Ovos são botados por distância.
 */
export function ciscoBuildRace(seed: number): CiscoCorrida {
  const rng = ciscoRandom((seed * 2654435761) >>> 0)
  const totalW = CISCO_GALINHAS.reduce((s, g) => s + g.peso, 0)
  const galinhas: CiscoGalinha[] = CISCO_GALINHAS.map((def, i) => {
    const prob = def.peso / totalW
    return {
      ...def,
      lane: i,
      odds: CISCO_ODDS[i]!,
      runSpeed: 1.15 + prob * 0.5 + rng() * 0.15,
      peckChance: 0.02 - prob * 0.01 + rng() * 0.006,
      peckMin: 0.15 + rng() * 0.2,
      peckMax: 0.5 + rng() * 1.1,
      traj: new Float32Array(CISCO_SIM_STEPS + 1),
      stateTraj: new Uint8Array(CISCO_SIM_STEPS + 1),
      legTraj: new Float32Array(CISCO_SIM_STEPS + 1),
      ovos: [],
    }
  })

  let vencedor: number | null = null
  const ordem: number[] = []
  const x = galinhas.map(() => 0)
  const leg = galinhas.map(() => 0)
  const ciscando = galinhas.map(() => false)
  const ciscaAte = galinhas.map(() => 0)
  const proximoOvoEm = galinhas.map(() => 800 + rng() * 1200)

  for (let s = 0; s <= CISCO_SIM_STEPS; s++) {
    const t = s / CISCO_SIM_STEPS
    const tm = t * (CISCO_CORRIDA_MS / 1000)
    galinhas.forEach((g, i) => {
      g.traj[s] = x[i]!
      g.stateTraj[s] = ciscando[i] ? 1 : 0
      g.legTraj[s] = leg[i]!
    })
    // decide o estado e avança quem está correndo
    galinhas.forEach((g, i) => {
      if (ciscando[i]) {
        if (tm >= ciscaAte[i]!) ciscando[i] = false // terminou de ciscar
      } else if (t > 0.05 && t < 0.92 && rng() < g.peckChance) {
        // começa a ciscar (nunca logo na largada nem no sprint final)
        ciscando[i] = true
        ciscaAte[i] = tm + g.peckMin + rng() * (g.peckMax - g.peckMin)
      }
      if (!ciscando[i]) {
        x[i]! += g.runSpeed * (CISCO_TRACK_LEN / (CISCO_CORRIDA_MS / 1000)) * SIM_DT
        leg[i]! += SIM_DT * 14
        // bota um ovo ao passar da distância marcada
        if (x[i]! >= proximoOvoEm[i]!) {
          g.ovos.push({ x: x[i]!, step: s })
          proximoOvoEm[i] = x[i]! + 1400 + rng() * 1600
        }
      }
    })
    // detecta cruzamentos (com fração interpolada para desempate fino)
    const cruzaram: Array<{ i: number; cross: number }> = []
    galinhas.forEach((g, i) => {
      if (ordem.includes(i)) return
      if (x[i]! >= CISCO_FINISH) {
        const prev = s > 0 ? g.traj[s - 1]! : 0
        const frac = x[i]! - prev > 0 ? (CISCO_FINISH - prev) / (x[i]! - prev) : 0
        cruzaram.push({ i, cross: s - 1 + frac })
      }
    })
    if (cruzaram.length) {
      cruzaram.sort((a, b) => a.cross - b.cross)
      cruzaram.forEach(({ i }) => {
        ordem.push(i)
        if (vencedor === null) vencedor = i
      })
    }
  }
  if (vencedor === null) {
    let best = 0
    for (let i = 1; i < galinhas.length; i++) if (x[i]! > x[best]!) best = i
    vencedor = best
  }
  galinhas
    .map((_, i) => i)
    .sort((a, b) => x[b]! - x[a]!)
    .forEach((i) => {
      if (!ordem.includes(i)) ordem.push(i)
    })

  const w = galinhas[vencedor]!
  let winCrossT = 1
  for (let s = 0; s <= CISCO_SIM_STEPS; s++) {
    if (w.traj[s]! >= CISCO_FINISH) {
      const prev = s > 0 ? w.traj[s - 1]! : 0
      const frac = w.traj[s]! - prev > 0 ? (CISCO_FINISH - prev) / (w.traj[s]! - prev) : 0
      winCrossT = (s - 1 + frac) / CISCO_SIM_STEPS
      break
    }
  }
  return { seed, vencedor, ordem, galinhas, winCrossT }
}

/** posição/estado/animação de uma galinha num tempo t (0..1) da corrida */
export function ciscoGalinhaAt(
  g: CiscoGalinha,
  t: number,
): { x: number; ciscando: boolean; legT: number; step: number } {
  const f = Math.max(0, Math.min(1, t)) * CISCO_SIM_STEPS
  const i = Math.floor(f)
  const frac = f - i
  const j = Math.min(CISCO_SIM_STEPS, i + 1)
  return {
    x: g.traj[i]! + (g.traj[j]! - g.traj[i]!) * frac,
    ciscando: g.stateTraj[i] === 1,
    legT: g.legTraj[i]! + (g.legTraj[j]! - g.legTraj[i]!) * frac,
    step: i,
  }
}

/** visão do cliente — a seed SÓ aparece a partir da largada */
export interface CiscoView {
  numero: number
  fase: CiscoFase
  faseFimEm: number
  largadaEm: number
  agora: number
  seed: number | null
  vencedor: number | null
  historico: string[]
}
