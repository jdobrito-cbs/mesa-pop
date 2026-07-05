import { describe, expect, it } from 'vitest'
import { loginSchema, passwordSchema, phoneSchema, registerSchema } from '@mesapop/shared'

describe('passwordSchema', () => {
  it('aceita senha forte', () => {
    expect(passwordSchema.safeParse('Senha123').success).toBe(true)
  })
  it.each([
    ['curta', 'Ab1'],
    ['sem maiúscula', 'senha123'],
    ['sem minúscula', 'SENHA123'],
    ['sem número', 'SenhaForte'],
  ])('rejeita senha %s', (_label, senha) => {
    expect(passwordSchema.safeParse(senha).success).toBe(false)
  })
})

describe('phoneSchema', () => {
  it.each(['11987654321', '(11) 98765-4321', '+55 11 98765-4321', '1134567890'])(
    'aceita %s',
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(true)
    },
  )
  it.each(['123', 'abcdefghijk', '119876543210000'])('rejeita %s', (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false)
  })
})

describe('registerSchema', () => {
  const base = {
    email: 'Jogador@Exemplo.com',
    username: 'jogador_um',
    name: 'Jogador Um',
    phone: '(11) 98765-4321',
    password: 'Senha123',
    passwordConfirm: 'Senha123',
  }
  it('normaliza e-mail para minúsculas e limpa telefone', () => {
    const parsed = registerSchema.parse(base)
    expect(parsed.email).toBe('jogador@exemplo.com')
    expect(parsed.phone).toBe('11987654321')
  })
  it('rejeita senhas diferentes', () => {
    const result = registerSchema.safeParse({ ...base, passwordConfirm: 'Outra123' })
    expect(result.success).toBe(false)
  })
  it('rejeita e-mail inválido', () => {
    expect(registerSchema.safeParse({ ...base, email: 'não-é-email' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('exige senha não vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})
