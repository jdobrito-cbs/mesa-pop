import { z } from 'zod'

/**
 * Validações de autenticação compartilhadas entre cliente e servidor.
 * O servidor é sempre a fonte de verdade; o cliente usa os mesmos schemas
 * para feedback imediato no formulário.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(254, 'E-mail longo demais')

/** Telefone brasileiro (com ou sem +55): 10 ou 11 dígitos após limpeza. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^(\+?55)?\d{10,11}$/, 'Telefone inválido — use DDD + número'),
  )

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres')
  .max(128, 'Senha longa demais')
  .regex(/[a-z]/, 'A senha precisa de uma letra minúscula')
  .regex(/[A-Z]/, 'A senha precisa de uma letra maiúscula')
  .regex(/\d/, 'A senha precisa de um número')

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nome curto demais')
  .max(80, 'Nome longo demais')

/** nome de usuário ÚNICO da plataforma — aparece nos rankings e jogos */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Nome de usuário precisa de 3+ caracteres')
  .max(20, 'Nome de usuário longo demais')
  .regex(/^[a-z0-9_.]+$/, 'Use apenas letras, números, ponto e _')

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    name: nameSchema,
    phone: phoneSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    avatar: z.string().trim().max(8).optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'As senhas não conferem',
    path: ['passwordConfirm'],
  })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
})

/** configuração inicial: cria o PRIMEIRO admin (sem telefone) */
export const setupSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    name: nameSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'As senhas não conferem',
    path: ['passwordConfirm'],
  })

export type RegisterInput = z.input<typeof registerSchema>
export type LoginInput = z.input<typeof loginSchema>
export type SetupInput = z.input<typeof setupSchema>
