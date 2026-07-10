import { describe, expect, it } from 'vitest'
import { AVATARES_NORMAIS, avatarAleatorioNormal, avatarTier, ehAvatarValido, paramsFromId } from '@mesapop/shared'

describe('avatares (gerador)', () => {
  it('tiers por id', () => {
    expect(avatarTier('n0')).toBe('normal')
    expect(avatarTier('n19')).toBe('normal')
    expect(avatarTier('n20')).toBeNull()
    expect(avatarTier('e0')).toBe('especial')
    expect(avatarTier('e999')).toBe('especial')
    expect(avatarTier('e1000')).toBeNull()
    expect(avatarTier('s14')).toBe('super')
    expect(avatarTier('s15')).toBeNull()
    expect(avatarTier('lixo')).toBeNull()
  })
  it('AVATARES_NORMAIS = 20 ids únicos e válidos', () => {
    expect(AVATARES_NORMAIS).toHaveLength(20)
    expect(new Set(AVATARES_NORMAIS).size).toBe(20)
    expect(AVATARES_NORMAIS.every((id) => ehAvatarValido(id) && avatarTier(id) === 'normal')).toBe(true)
  })
  it('paramsFromId é determinístico e coerente com o tier', () => {
    const a = paramsFromId('e42')
    const b = paramsFromId('e42')
    expect(a).toEqual(b)
    expect(paramsFromId('n3').acessorio).toBe(0)
    expect(paramsFromId('n3').moldura).toBe(0)
    expect(paramsFromId('e3').acessorio).toBeGreaterThan(0)
    expect(paramsFromId('s3').moldura).toBeGreaterThan(0)
  })
  it('avatarAleatorioNormal devolve sempre um normal válido', () => {
    let x = 0
    const rnd = () => (x = (x + 0.137) % 1)
    for (let i = 0; i < 40; i++) expect(avatarTier(avatarAleatorioNormal(rnd))).toBe('normal')
  })
})
