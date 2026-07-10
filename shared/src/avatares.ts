import { hashSeed, intAte, mulberry32 } from './seed.js'

/**
 * Catálogo de avatares procedurais. Ids curtos: normais n0..n19, especiais
 * e0..e999, super s0..s14. paramsFromId é determinístico (mesma seed →
 * mesmo avatar). Estilos (referências do usuário, recriadas — nunca
 * clonadas): NORMAIS = rostos cartoon de pessoas + bichos flat em círculo
 * chapado; ESPECIAIS = ícones gamer flat + mascotes de e-sports; SUPER =
 * mascotes premium com moldura. Expressões: sorriso, sério ou bravo —
 * NUNCA triste (pedido do usuário).
 */
export type AvatarTier = 'normal' | 'especial' | 'super'
export type AvatarTipo = 'pessoa' | 'bicho' | 'icone' | 'mascote'
export type AvatarExpressao = 'sorriso' | 'serio' | 'bravo'

/** bichos flat dos normais (círculo chapado, estilo ícone) */
export const AVATAR_BICHOS = ['leao', 'panda', 'raposa', 'urso', 'coruja', 'gato', 'cachorro', 'coelho'] as const
/** objetos gamer dos especiais (círculo chapado) */
export const AVATAR_ICONES = ['controle', 'joystick', 'dado', 'trofeu', 'foguete', 'bomba', 'bau', 'pocao', 'coroa', 'ficha', 'coracao', 'estrela'] as const
/** mascotes de e-sports (especiais e super) */
export const AVATAR_MASCOTES = ['leao', 'coruja', 'ninja', 'caveira', 'fenix', 'robo', 'touro', 'dragao', 'lobo', 'tubarao', 'aguia', 'samurai'] as const

export interface AvatarParams {
  tier: AvatarTier
  tipo: AvatarTipo
  /** índice do desenho dentro do tipo (penteado / bicho / objeto / mascote) */
  variante: number
  expressao: AvatarExpressao
  /** pessoas: tom de pele e cor do cabelo */
  pele: string
  cabelo: string
  /** cor principal e secundária do desenho (bicho/ícone/mascote/camisa) */
  corBase: string
  corSec: string
  fundo: string
  oculos: boolean
  /** 0 = normais; >0 = especiais/super (riqueza extra do tier) */
  acessorio: number
  /** 0 = sem moldura; >0 = super (anel girante) */
  moldura: number
}

/** fundos CHAPADOS e vivos (círculo do avatar), como nas referências */
export const AVATAR_FUNDOS = ['#f2695c', '#f7a325', '#57b947', '#2f9e8f', '#3d7dd8', '#7c5cc4', '#e0558f', '#f0c33c', '#5aa8e0', '#8f6c56', '#67b06b', '#d8556b'] as const
const CORES_VIVAS = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399', '#a855f7', '#fb923c', '#ef4444', '#3b82f6', '#4ade80', '#f59e0b']
const PELES = ['#ffd9b8', '#f5c09a', '#dfa06e', '#b97a4d', '#8a5a38', '#6b4429']
const CABELOS = ['#2b2118', '#57351f', '#8a5a2b', '#c98a3a', '#e0b34c', '#c94f2e', '#9c9c9c', '#e8e4da', '#3d6fd8', '#d84f9c']

const N_NORMAIS = 20
const N_ESPECIAIS = 1000
const N_SUPER = 15

export function avatarTier(id: string): AvatarTier | null {
  const m = /^([nes])(\d{1,4})$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  if (m[1] === 'n') return n < N_NORMAIS ? 'normal' : null
  if (m[1] === 'e') return n < N_ESPECIAIS ? 'especial' : null
  return n < N_SUPER ? 'super' : null
}
export const ehAvatarValido = (id: string): boolean => avatarTier(id) !== null

export const AVATARES_NORMAIS = Array.from({ length: N_NORMAIS }, (_, i) => `n${i}`)
export const AVATARES_ESPECIAIS = Array.from({ length: N_ESPECIAIS }, (_, i) => `e${i}`)
export const AVATARES_SUPER = Array.from({ length: N_SUPER }, (_, i) => `s${i}`)

export function avatarAleatorioNormal(rnd: () => number = Math.random): string {
  return `n${Math.floor(rnd() * N_NORMAIS)}`
}

/**
 * Os 20 NORMAIS são curados à mão: 12 pessoas (penteados/tons variados,
 * algumas de óculos, maioria sorrindo, duas sérias e uma brava) + 8 bichos.
 * variante (pessoa) = penteado: 0 curto, 1 franja, 2 cacheado volumoso,
 * 3 coque, 4 maria-chiquinha, 5 rabo de cavalo, 6 grisalho (vô/vó),
 * 7 careca+barba, 8 longo liso, 9 lenço/bandana, 10 topete, 11 cacho curto.
 */
interface NormalDef {
  tipo: 'pessoa' | 'bicho'
  variante: number
  expressao: AvatarExpressao
  pele: number
  cabelo: number
  fundo: number
  cor: number
  oculos?: boolean
}
const NORMAIS: NormalDef[] = [
  { tipo: 'pessoa', variante: 0, expressao: 'sorriso', pele: 1, cabelo: 0, fundo: 4, cor: 1 },
  { tipo: 'pessoa', variante: 2, expressao: 'sorriso', pele: 4, cabelo: 0, fundo: 1, cor: 3 },
  { tipo: 'pessoa', variante: 8, expressao: 'sorriso', pele: 0, cabelo: 5, fundo: 2, cor: 5 },
  { tipo: 'pessoa', variante: 4, expressao: 'sorriso', pele: 2, cabelo: 1, fundo: 6, cor: 2 },
  { tipo: 'pessoa', variante: 6, expressao: 'sorriso', pele: 1, cabelo: 7, fundo: 3, cor: 0, oculos: true },
  { tipo: 'pessoa', variante: 1, expressao: 'serio', pele: 3, cabelo: 0, fundo: 7, cor: 7 },
  { tipo: 'pessoa', variante: 3, expressao: 'sorriso', pele: 0, cabelo: 9, fundo: 5, cor: 4, oculos: true },
  { tipo: 'pessoa', variante: 9, expressao: 'sorriso', pele: 2, cabelo: 5, fundo: 0, cor: 8 },
  { tipo: 'pessoa', variante: 10, expressao: 'sorriso', pele: 1, cabelo: 4, fundo: 8, cor: 6 },
  { tipo: 'pessoa', variante: 7, expressao: 'serio', pele: 4, cabelo: 6, fundo: 9, cor: 9, oculos: true },
  { tipo: 'pessoa', variante: 11, expressao: 'sorriso', pele: 5, cabelo: 0, fundo: 10, cor: 1 },
  { tipo: 'pessoa', variante: 5, expressao: 'bravo', pele: 0, cabelo: 8, fundo: 11, cor: 0 },
  { tipo: 'bicho', variante: 0, expressao: 'serio', pele: 0, cabelo: 0, fundo: 1, cor: 2 }, // leão
  { tipo: 'bicho', variante: 1, expressao: 'sorriso', pele: 0, cabelo: 0, fundo: 3, cor: 0 }, // panda
  { tipo: 'bicho', variante: 2, expressao: 'sorriso', pele: 0, cabelo: 0, fundo: 2, cor: 5 }, // raposa
  { tipo: 'bicho', variante: 3, expressao: 'serio', pele: 0, cabelo: 0, fundo: 8, cor: 9 }, // urso
  { tipo: 'bicho', variante: 4, expressao: 'serio', pele: 0, cabelo: 0, fundo: 5, cor: 1 }, // coruja
  { tipo: 'bicho', variante: 5, expressao: 'sorriso', pele: 0, cabelo: 0, fundo: 0, cor: 3 }, // gato
  { tipo: 'bicho', variante: 6, expressao: 'sorriso', pele: 0, cabelo: 0, fundo: 4, cor: 6 }, // cachorro
  { tipo: 'bicho', variante: 7, expressao: 'sorriso', pele: 0, cabelo: 0, fundo: 6, cor: 7 }, // coelho
]

/** os 15 SUPER: mascotes premium (um de cada, com moldura) */
const SUPERS: Array<{ variante: number; fundo: number }> = [
  { variante: 0, fundo: 1 }, // leão
  { variante: 4, fundo: 0 }, // fênix
  { variante: 7, fundo: 6 }, // dragão
  { variante: 2, fundo: 3 }, // ninja
  { variante: 11, fundo: 11 }, // samurai
  { variante: 1, fundo: 5 }, // coruja
  { variante: 3, fundo: 9 }, // caveira
  { variante: 5, fundo: 4 }, // robô
  { variante: 6, fundo: 2 }, // touro
  { variante: 8, fundo: 8 }, // lobo
  { variante: 9, fundo: 4 }, // tubarão
  { variante: 10, fundo: 1 }, // águia
  { variante: 0, fundo: 7 }, // leão (paleta alternativa)
  { variante: 7, fundo: 2 }, // dragão (paleta alternativa)
  { variante: 4, fundo: 5 }, // fênix (paleta alternativa)
]

export function paramsFromId(id: string): AvatarParams {
  const tier = avatarTier(id) ?? 'normal'
  const rnd = mulberry32(hashSeed(id || 'n0'))

  if (tier === 'normal' && /^n\d+$/.test(id)) {
    const d = NORMAIS[Number(id.slice(1))]!
    return {
      tier,
      tipo: d.tipo,
      variante: d.variante,
      expressao: d.expressao,
      pele: PELES[d.pele]!,
      cabelo: CABELOS[d.cabelo]!,
      corBase: CORES_VIVAS[d.cor]!,
      corSec: CORES_VIVAS[(d.cor + 3) % CORES_VIVAS.length]!,
      fundo: AVATAR_FUNDOS[d.fundo]!,
      oculos: !!d.oculos,
      acessorio: 0,
      moldura: 0,
    }
  }

  if (tier === 'super' && /^s\d+$/.test(id)) {
    const d = SUPERS[Number(id.slice(1))]!
    return {
      tier,
      tipo: 'mascote',
      variante: d.variante,
      expressao: 'bravo',
      pele: PELES[0]!,
      cabelo: CABELOS[0]!,
      corBase: CORES_VIVAS[intAte(rnd, CORES_VIVAS.length)]!,
      corSec: CORES_VIVAS[intAte(rnd, CORES_VIVAS.length)]!,
      fundo: AVATAR_FUNDOS[d.fundo]!,
      oculos: false,
      acessorio: 1 + intAte(rnd, 5),
      moldura: 1 + intAte(rnd, 4),
    }
  }

  // ESPECIAIS (e#) e qualquer string usada como seed (fallback: nome de
  // usuário vira um rosto/bicho estável): tudo derivado do hash.
  const especial = tier === 'especial'
  const tipo: AvatarTipo = especial
    ? intAte(rnd, 2) === 0 ? 'icone' : 'mascote'
    : intAte(rnd, 2) === 0 ? 'pessoa' : 'bicho'
  const nVar = tipo === 'pessoa' ? 12 : tipo === 'bicho' ? AVATAR_BICHOS.length : tipo === 'icone' ? AVATAR_ICONES.length : AVATAR_MASCOTES.length
  const exps: AvatarExpressao[] = tipo === 'mascote' ? ['bravo', 'serio'] : ['sorriso', 'sorriso', 'serio', 'bravo']
  return {
    tier,
    tipo,
    variante: intAte(rnd, nVar),
    expressao: exps[intAte(rnd, exps.length)]!,
    pele: PELES[intAte(rnd, PELES.length)]!,
    cabelo: CABELOS[intAte(rnd, CABELOS.length)]!,
    corBase: CORES_VIVAS[intAte(rnd, CORES_VIVAS.length)]!,
    corSec: CORES_VIVAS[intAte(rnd, CORES_VIVAS.length)]!,
    fundo: AVATAR_FUNDOS[intAte(rnd, AVATAR_FUNDOS.length)]!,
    oculos: intAte(rnd, 5) === 0,
    acessorio: especial ? 1 + intAte(rnd, 5) : 0,
    moldura: 0,
  }
}
