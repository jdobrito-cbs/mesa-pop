import { hashSeed, intAte, mulberry32 } from './seed.js'

/**
 * Catálogo de avatares procedurais (bichinhos + personagens). Ids curtos:
 * normais n0..n19, especiais e0..e999, super s0..s14. paramsFromId é
 * determinístico (mesma seed → mesmo avatar). O tier controla a riqueza.
 */
export type AvatarTier = 'normal' | 'especial' | 'super'

export const AVATAR_ESPECIES = [
  'gato', 'coruja', 'raposa', 'robo', 'alien', 'fantasma', 'sapo', 'panda', 'urso', 'dino',
] as const
export type AvatarEspecie = (typeof AVATAR_ESPECIES)[number]

export interface AvatarParams {
  tier: AvatarTier
  especie: AvatarEspecie
  corBase: string
  corSec: string
  fundo: string
  olhos: number
  boca: number
  acessorio: number
  moldura: number
}

const PALETA = ['#ff3ea5', '#22d3ee', '#facc15', '#34d399', '#a855f7', '#fb923c', '#f472b6', '#38bdf8', '#4ade80', '#f59e0b']
const FUNDOS = ['#1b2340', '#2a1e3f', '#14343a', '#3a2418', '#1e2a1e', '#301a2a']

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

export function paramsFromId(id: string): AvatarParams {
  const tier = avatarTier(id) ?? 'normal'
  const rnd = mulberry32(hashSeed(id || 'n0'))
  const especie = AVATAR_ESPECIES[intAte(rnd, AVATAR_ESPECIES.length)]!
  const corBase = PALETA[intAte(rnd, PALETA.length)]!
  let corSec = PALETA[intAte(rnd, PALETA.length)]!
  if (corSec === corBase) corSec = PALETA[(PALETA.indexOf(corBase) + 3) % PALETA.length]!
  const fundo = FUNDOS[intAte(rnd, FUNDOS.length)]!
  const olhos = intAte(rnd, 4)
  const boca = intAte(rnd, 4)
  const acessorio = tier === 'normal' ? 0 : 1 + intAte(rnd, tier === 'super' ? 6 : 5)
  const moldura = tier === 'super' ? 1 + intAte(rnd, 4) : 0
  return { tier, especie, corBase, corSec, fundo, olhos, boca, acessorio, moldura }
}
