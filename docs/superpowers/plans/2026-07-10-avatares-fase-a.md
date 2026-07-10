# Avatares (Fase A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundação de avatares do Mesa Pop — gerador procedural em SVG (todos os tiers), avatar ativo por usuário, escolha no cadastro/login/convidado, menu "Meus avatares" e exibição do avatar no sistema. Especiais/super são gerados mas ficam bloqueados (desbloqueio é Fase C/D).

**Architecture:** Um módulo puro em `/shared` (`avatares.ts`) define os ids/tiers e `paramsFromId(id)` determinístico (via `hashSeed`/`mulberry32` de `shared/seed.ts`). O frontend tem `AvatarSvg` que desenha o avatar a partir dos params (bichinhos + personagens). O backend guarda só o avatar ativo (`User.avatar`) e um `avatarPromptedAt`, valida a troca (só normais liberados na Fase A) e atribui avatar no cadastro/convidado. `UserPublic.avatar` faz o avatar trafegar em header/salas/rankings.

**Tech Stack:** npm workspaces (`shared`/`backend`/`frontend`); backend Fastify + Prisma (Postgres), rodado por tsx; frontend React + Vite + TailwindCSS v4; testes com vitest.

## Global Constraints

- Idioma pt-BR em toda a UI e comentários.
- SVG 100% procedural — sem assets externos nem imagens de IA.
- Lógica compartilhável fica em `/shared`; servidor é a fonte de verdade (valida a troca de avatar).
- Nunca commitar `.env`/segredos.
- Testes rodam em série: `npx vitest run --no-file-parallelism` (os testes de integração dividem um Postgres).
- Ao fechar a fase: `npm run installer` **e** `npm run wsrta`; commit + `git push origin main`; atualizar o ESTADO ATUAL do `CLAUDE.md`.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Gerador de avatares em `/shared`

**Files:**
- Create: `shared/src/avatares.ts`
- Modify: `shared/src/index.ts` (adicionar `export * from './avatares.js'`)
- Test: `backend/test/avatares.test.ts` (o vitest do projeto roda no workspace backend, que importa `@mesapop/shared`)

**Interfaces:**
- Consumes: `hashSeed`, `mulberry32`, `intAte` de `shared/src/seed.ts`.
- Produces: `AvatarTier`, `AvatarParams`, `paramsFromId(id): AvatarParams`, `avatarTier(id): AvatarTier | null`, `ehAvatarValido(id): boolean`, `AVATARES_NORMAIS: string[]` (n0..n19), `avatarAleatorioNormal(rnd?): string`, `AVATAR_ESPECIES`.

- [ ] **Step 1: Escrever o teste que falha** — `backend/test/avatares.test.ts`

```ts
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
    expect(paramsFromId('n3').acessorio).toBe(0) // normal = sem acessório
    expect(paramsFromId('n3').moldura).toBe(0)
    expect(paramsFromId('e3').acessorio).toBeGreaterThan(0) // especial ganha acessório
    expect(paramsFromId('s3').moldura).toBeGreaterThan(0) // super ganha moldura
  })
  it('avatarAleatorioNormal devolve sempre um normal válido', () => {
    let x = 0
    const rnd = () => (x = (x + 0.137) % 1)
    for (let i = 0; i < 40; i++) expect(avatarTier(avatarAleatorioNormal(rnd))).toBe('normal')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run backend/test/avatares.test.ts`
Expected: FAIL — `@mesapop/shared` não exporta `paramsFromId`/`avatarTier`.

- [ ] **Step 3: Criar `shared/src/avatares.ts`**

```ts
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
  olhos: number // 0..3
  boca: number // 0..3
  acessorio: number // 0 = nenhum (normais); >0 = especiais/super
  moldura: number // 0 = nenhuma; >0 = super
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
```

- [ ] **Step 4: Exportar no índice do shared** — em `shared/src/index.ts`, após `export * from './desafio.js'`, adicionar:

```ts
export * from './avatares.js'
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run backend/test/avatares.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add shared/src/avatares.ts shared/src/index.ts backend/test/avatares.test.ts
git commit -m "feat(avatares): gerador procedural em /shared (tiers + paramsFromId)"
```

---

### Task 2: `UserPublic.avatar` no shared + `toPublicUser`

**Files:**
- Modify: `shared/src/types.ts` (interface `UserPublic`)
- Modify: `backend/src/lib/user.ts` (`toPublicUser`)

**Interfaces:**
- Produces: `UserPublic.avatar: string | null` presente em todo lugar que serializa usuário.
- Consumes: campo `User.avatar` do Prisma (criado na Task 3 — a compilação do backend só fecha após a Task 3; ok, esta task é só de tipos/shared).

- [ ] **Step 1: Adicionar o campo em `UserPublic`** — em `shared/src/types.ts`, dentro de `interface UserPublic`, após `avatarUrl: string | null`:

```ts
  /** id do avatar ativo (procedural). null = ainda não escolheu */
  avatar: string | null
```

- [ ] **Step 2: Incluir em `toPublicUser`** — em `backend/src/lib/user.ts`, adicionar no objeto retornado, após `avatarUrl: user.avatarUrl,`:

```ts
    avatar: user.avatar ?? null,
```

- [ ] **Step 3: Typecheck do shared**

Run: `npm run typecheck -w shared`
Expected: PASS. (O backend só fecha após a Task 3 — sem commit isolado aqui; commit junto na Task 3.)

---

### Task 3: Migração — `User.avatar` + `User.avatarPromptedAt`

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `User`)
- Create: `backend/prisma/migrations/20260710120000_avatar/migration.sql`

**Interfaces:**
- Produces: colunas `User.avatar` (TEXT null) e `User.avatarPromptedAt` (TIMESTAMP null).

- [ ] **Step 1: Adicionar os campos no schema** — em `backend/prisma/schema.prisma`, no model `User`, logo após a linha `avatarUrl    String?`:

```prisma
  /** id do avatar procedural ativo (n#/e#/s#) */
  avatar       String?
  /** quando o modal "escolha seu avatar" foi mostrado (só uma vez) */
  avatarPromptedAt DateTime?
```

- [ ] **Step 2: Criar a migração à mão** (o `migrate dev` não roda em terminal não-interativo; usar a ferramenta Write para evitar BOM) — `backend/prisma/migrations/20260710120000_avatar/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarPromptedAt" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerar o client e aplicar a migração** (pare o backend dev antes, senão a DLL do Prisma trava no Windows)

Run:
```bash
cd backend && npx prisma generate && npx prisma migrate deploy && cd ..
```
Expected: "All migrations have been successfully applied." e client gerado.

- [ ] **Step 4: Typecheck backend + shared**

Run: `npm run typecheck -w shared -w backend`
Expected: PASS (o `avatar` agora existe no tipo `User` do Prisma).

- [ ] **Step 5: Commit** (Tasks 2+3 juntas)

```bash
git add shared/src/types.ts backend/src/lib/user.ts backend/prisma/schema.prisma backend/prisma/migrations/20260710120000_avatar
git commit -m "feat(avatares): campo User.avatar + avatarPromptedAt; UserPublic.avatar"
```

---

### Task 4: Cadastro e convidado atribuem avatar

**Files:**
- Modify: `shared/src/auth.ts` (`registerSchema` ganha `avatar` opcional)
- Modify: `backend/src/routes/auth.ts` (register salva `avatar`; guest recebe normal aleatório)
- Test: `backend/test/avatar-auth.test.ts`

**Interfaces:**
- Consumes: `ehAvatarValido`, `avatarTier`, `avatarAleatorioNormal` (Task 1); `registerSchema` (modificado).
- Produces: usuário criado com `avatar` preenchido (normal). Register aceita `avatar?: string` no body.

- [ ] **Step 1: `avatar` opcional no `registerSchema`** — em `shared/src/auth.ts`, dentro do `.object({...})` do `registerSchema`, após `phone: phoneSchema,`:

```ts
    avatar: z.string().trim().max(8).optional(),
```

- [ ] **Step 2: Register e guest atribuem o avatar** — em `backend/src/routes/auth.ts`:
  - importar no topo (junto do import de `@mesapop/shared`): `avatarTier`, `avatarAleatorioNormal`.
  - no handler de `register`, no `prisma.user.create({ data: {...} })`, adicionar ao `data` (usa o escolhido só se for um NORMAL válido; senão sorteia):

```ts
        avatar: input.avatar && avatarTier(input.avatar) === 'normal' ? input.avatar : avatarAleatorioNormal(),
```
  - no handler de `guest`, no `prisma.user.create({ data: {...} })`, adicionar ao `data`:

```ts
        avatar: avatarAleatorioNormal(),
```

- [ ] **Step 3: Teste** — `backend/test/avatar-auth.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { avatarTier } from '@mesapop/shared'
import { buildApp } from '../src/app'

const runId = `av${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
beforeAll(async () => { app = await buildApp({ disableRateLimit: true, logger: false }) })
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: runId } }, { displayName: { startsWith: runId } }] } })
  await app.close()
})

describe('avatar no cadastro/convidado', () => {
  it('register salva o avatar normal escolhido', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}a@t.local`, username: `${runId}a`, name: 'A', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123', avatar: 'n5' } })
    expect(r.statusCode).toBe(201)
    expect(r.json().user.avatar).toBe('n5')
  })
  it('register sem avatar (ou inválido) cai num normal aleatório', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}b@t.local`, username: `${runId}b`, name: 'B', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123', avatar: 'e1' } })
    expect(r.statusCode).toBe(201)
    expect(avatarTier(r.json().user.avatar)).toBe('normal') // 'e1' (especial) recusado → normal
  })
  it('convidado recebe um normal', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/guest', body: { name: `${runId}g` } })
    expect(r.statusCode).toBe(201)
    expect(avatarTier(r.json().user.avatar)).toBe('normal')
  })
})
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run backend/test/avatar-auth.test.ts --no-file-parallelism`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add shared/src/auth.ts backend/src/routes/auth.ts backend/test/avatar-auth.test.ts
git commit -m "feat(avatares): cadastro escolhe avatar; convidado recebe normal aleatorio"
```

---

### Task 5: Endpoints `PUT /api/me/avatar` e `POST /api/me/avatar/prompt-visto`

**Files:**
- Modify: `backend/src/routes/me.ts` (novas rotas)
- Test: `backend/test/avatar-me.test.ts`

**Interfaces:**
- Consumes: `ehAvatarValido`, `avatarTier` (Task 1).
- Produces: `PUT /api/me/avatar { id }` → 200 `{ avatar }` (só normais na Fase A; especial/super → 403 `AVATAR_LOCKED`; inválido → 400). `POST /api/me/avatar/prompt-visto` → 200 `{ ok: true }` grava `avatarPromptedAt=now`.

- [ ] **Step 1: Teste** — `backend/test/avatar-me.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'

const runId = `me${Math.random().toString(36).slice(2, 8)}`
let app: FastifyInstance
let token = ''
beforeAll(async () => {
  app = await buildApp({ disableRateLimit: true, logger: false })
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', body: { email: `${runId}@t.local`, username: `u${runId}`, name: 'M', phone: '11987654321', password: 'Senha123', passwordConfirm: 'Senha123' } })
  token = r.json().accessToken
})
afterAll(async () => { await app.prisma.user.deleteMany({ where: { email: { startsWith: runId } } }); await app.close() })
const auth = () => ({ authorization: `Bearer ${token}` })

describe('me/avatar', () => {
  it('troca para um normal', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'n8' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().avatar).toBe('n8')
  })
  it('recusa especial/super (bloqueado na Fase A)', async () => {
    const esp = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'e10' } })
    expect(esp.statusCode).toBe(403)
    expect(esp.json().error).toBe('AVATAR_LOCKED')
  })
  it('recusa id inválido', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/me/avatar', headers: auth(), body: { id: 'zzz' } })
    expect(r.statusCode).toBe(400)
  })
  it('prompt-visto grava a data', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/me/avatar/prompt-visto', headers: auth() })
    expect(r.statusCode).toBe(200)
    const u = await app.prisma.user.findUnique({ where: { email: `${runId}@t.local` } })
    expect(u?.avatarPromptedAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run backend/test/avatar-me.test.ts --no-file-parallelism`
Expected: FAIL (rotas 404).

- [ ] **Step 3: Implementar as rotas** — em `backend/src/routes/me.ts`:
  - topo: `import { z } from 'zod'` e `import { avatarTier, ehAvatarValido } from '@mesapop/shared'`.
  - dentro de `meRoutes`, adicionar:

```ts
  app.put('/api/me/avatar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().trim() }).parse(req.body)
    if (!ehAvatarValido(id)) return reply.code(400).send({ error: 'INVALID_AVATAR', message: 'Avatar inválido' })
    // Fase A: só os NORMAIS estão liberados; especiais/super serão desbloqueados nas fases C/D
    if (avatarTier(id) !== 'normal') {
      return reply.code(403).send({ error: 'AVATAR_LOCKED', message: 'Esse avatar ainda está bloqueado — conquiste nos rankings ou com fichas' })
    }
    await app.prisma.user.update({ where: { id: req.auth!.sub }, data: { avatar: id } })
    return { avatar: id }
  })

  app.post('/api/me/avatar/prompt-visto', { preHandler: [app.authenticate] }, async (req) => {
    await app.prisma.user.update({ where: { id: req.auth!.sub }, data: { avatarPromptedAt: new Date() } })
    return { ok: true }
  })
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run backend/test/avatar-me.test.ts --no-file-parallelism`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/me.ts backend/test/avatar-me.test.ts
git commit -m "feat(avatares): PUT /api/me/avatar (so normais) + prompt-visto"
```

---

### Task 6: Componente `AvatarSvg`

**Files:**
- Create: `frontend/src/components/AvatarSvg.tsx`

**Interfaces:**
- Consumes: `paramsFromId`, `AvatarParams` (Task 1).
- Produces: `default export function AvatarSvg({ id, size }: { id: string | null | undefined; size?: number })` → SVG do avatar (fundo redondo + face da espécie + acessório por tier + moldura no super).

- [ ] **Step 1: Criar o componente** — `frontend/src/components/AvatarSvg.tsx`. Desenha num viewBox 100×100: círculo de fundo (`fundo`), corpo/rosto por `especie` (formas + `corBase`/`corSec`), olhos (`olhos`), boca (`boca`), acessório quando `acessorio>0` (chapéu/óculos/coroa/estrela), e um anel de moldura quando `moldura>0` (super). Implementar cada espécie como um pequeno grupo `<g>` (orelhas/bico/antenas conforme o bicho). Código base:

```tsx
import { paramsFromId, type AvatarParams } from '@mesapop/shared'

function Orelhas({ p }: { p: AvatarParams }) {
  // orelhas/traços por espécie (gato: triângulos; coruja: tufos; raposa: pontudas; etc.)
  switch (p.especie) {
    case 'gato':
    case 'raposa':
      return (
        <g fill={p.corBase} stroke={p.corSec} strokeWidth={2}>
          <path d="M28 34 L22 14 L42 28 Z" />
          <path d="M72 34 L78 14 L58 28 Z" />
        </g>
      )
    case 'coruja':
      return <g fill={p.corSec}><circle cx={34} cy={30} r={4} /><circle cx={66} cy={30} r={4} /></g>
    case 'alien':
    case 'robo':
      return (
        <g stroke={p.corSec} strokeWidth={3}>
          <line x1={34} y1={26} x2={30} y2={12} /><circle cx={30} cy={10} r={4} fill={p.corSec} stroke="none" />
          <line x1={66} y1={26} x2={70} y2={12} /><circle cx={70} cy={10} r={4} fill={p.corSec} stroke="none" />
        </g>
      )
    case 'panda':
    case 'urso':
      return <g fill={p.corSec}><circle cx={30} cy={26} r={9} /><circle cx={70} cy={26} r={9} /></g>
    default:
      return null
  }
}

function Olhos({ p }: { p: AvatarParams }) {
  const y = 52
  if (p.olhos === 0) return <g fill="#101728"><circle cx={40} cy={y} r={6} /><circle cx={60} cy={y} r={6} /></g>
  if (p.olhos === 1) return <g fill="#101728"><circle cx={40} cy={y} r={7} /><circle cx={60} cy={y} r={7} /><circle cx={42} cy={y - 2} r={2} fill="#fff" /><circle cx={62} cy={y - 2} r={2} fill="#fff" /></g>
  if (p.olhos === 2) return <g stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round"><path d={`M34 ${y} q6 -8 12 0`} /><path d={`M54 ${y} q6 -8 12 0`} /></g>
  return <g fill="#101728"><rect x={35} y={y - 5} width={10} height={10} rx={2} /><rect x={55} y={y - 5} width={10} height={10} rx={2} /></g>
}

function Boca({ p }: { p: AvatarParams }) {
  const y = 68
  if (p.boca === 0) return <path d={`M42 ${y} q8 8 16 0`} stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round" />
  if (p.boca === 1) return <circle cx={50} cy={y} r={4} fill="#101728" />
  if (p.boca === 2) return <path d={`M42 ${y + 2} q8 -8 16 0`} stroke="#101728" strokeWidth={3} fill="none" strokeLinecap="round" />
  return <rect x={44} y={y - 2} width={12} height={5} rx={2} fill="#101728" />
}

function Acessorio({ p }: { p: AvatarParams }) {
  if (p.acessorio <= 0) return null
  switch (p.acessorio) {
    case 1: return <path d="M28 30 h44 l-6 -12 h-32 Z" fill={p.corSec} stroke="#0008" strokeWidth={1.5} /> // chapéu
    case 2: return <g stroke="#101728" strokeWidth={3} fill="#ffffff55"><circle cx={40} cy={52} r={9} /><circle cx={60} cy={52} r={9} /><line x1={49} y1={52} x2={51} y2={52} /></g> // óculos
    case 3: return <path d="M32 24 l6 10 l12 -8 l12 8 l6 -10 v10 h-36 Z" fill="#facc15" stroke="#0006" strokeWidth={1.5} /> // coroa
    case 4: return <text x={72} y={28} fontSize={18}>✨</text>
    case 5: return <text x={70} y={30} fontSize={18}>⭐</text>
    default: return <text x={70} y={30} fontSize={18}>🎩</text>
  }
}

export default function AvatarSvg({ id, size = 40 }: { id: string | null | undefined; size?: number }) {
  const p = paramsFromId(id || 'n0')
  const anim = p.moldura > 0 // super: moldura girando
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="avatar" className="shrink-0">
      {p.moldura > 0 && (
        <circle cx={50} cy={50} r={49} fill="none" stroke={p.corSec} strokeWidth={3} strokeDasharray="10 6" className={anim ? 'animate-[spin_8s_linear_infinite]' : ''} style={{ transformOrigin: '50% 50%' }} />
      )}
      <circle cx={50} cy={50} r={44} fill={p.fundo} />
      <Orelhas p={p} />
      <circle cx={50} cy={54} r={30} fill={p.corBase} stroke={p.corSec} strokeWidth={2} />
      <Olhos p={p} />
      <Boca p={p} />
      <Acessorio p={p} />
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck do frontend**

Run: `npm run typecheck -w frontend`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AvatarSvg.tsx
git commit -m "feat(avatares): componente AvatarSvg (bichinhos + personagens)"
```

---

### Task 7: Escolha do avatar no cadastro

**Files:**
- Modify: `frontend/src/pages/Register.tsx`

**Interfaces:**
- Consumes: `AVATARES_NORMAIS` (Task 1), `AvatarSvg` (Task 6), `form.avatar` no `RegisterInput` (Task 4).

- [ ] **Step 1: Adicionar o seletor** — em `Register.tsx`:
  - import: `import AvatarSvg from '../components/AvatarSvg'` e `import { AVATARES_NORMAIS } from '@mesapop/shared'`.
  - no `useState<RegisterInput>({...})`, incluir `avatar: AVATARES_NORMAIS[Math.floor(Math.random() * AVATARES_NORMAIS.length)]`.
  - antes do botão de enviar, inserir a grade (selecionável) que grava `form.avatar`:

```tsx
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Escolha seu avatar</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {AVATARES_NORMAIS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, avatar: id }))}
                aria-pressed={form.avatar === id}
                className={`rounded-full ring-2 transition ${form.avatar === id ? 'ring-pop-cyan' : 'ring-transparent hover:ring-ink-600'}`}
              >
                <AvatarSvg id={id} size={44} />
              </button>
            ))}
          </div>
        </div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w frontend`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Register.tsx
git commit -m "feat(avatares): grade de escolha de avatar no cadastro"
```

---

### Task 8: Header — avatar + menu "Meus avatares" + modal

**Files:**
- Create: `frontend/src/components/MeusAvataresModal.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/lib/auth.tsx` (expor `refreshUser`/atualizar o `user.avatar` após troca)

**Interfaces:**
- Consumes: `AvatarSvg`, `AVATARES_NORMAIS`, `AVATARES_ESPECIAIS`, `AVATARES_SUPER`, `api`, `useAuth`.
- Produces: `MeusAvataresModal` (escolhe o avatar ativo; normais selecionáveis, especiais/super bloqueados). Header mostra `<AvatarSvg id={user.avatar}>` ao lado do nome e um botão "Meus avatares".

- [ ] **Step 1: `auth.tsx` — atualizar o avatar localmente** — no `AuthProvider`, expor no contexto uma função `setAvatar(id: string)` que faz `setUser((u) => (u ? { ...u, avatar: id } : u))`. Adicionar `setAvatar` à interface `AuthContextValue` e ao `value` do provider.

- [ ] **Step 2: Criar `MeusAvataresModal.tsx`**

```tsx
import { useState } from 'react'
import { AVATARES_ESPECIAIS, AVATARES_NORMAIS, AVATARES_SUPER } from '@mesapop/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import AvatarSvg from './AvatarSvg'

export default function MeusAvataresModal({ onClose }: { onClose: () => void }) {
  const { user, setAvatar } = useAuth()
  const [erro, setErro] = useState('')
  async function escolher(id: string) {
    setErro('')
    try {
      await api('/api/me/avatar', { method: 'PUT', body: { id } })
      setAvatar(id)
    } catch {
      setErro('Esse avatar ainda está bloqueado — conquiste nos rankings ou com fichas.')
    }
  }
  const bloqueados = [...AVATARES_ESPECIAIS.slice(0, 24), ...AVATARES_SUPER.slice(0, 6)] // preview
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/80 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Meus avatares</h2>
          <button onClick={onClose} className="btn-pop px-3 py-1.5 text-sm ring-1 ring-ink-700">Fechar</button>
        </div>
        {erro && <p className="mb-2 text-sm font-semibold text-pop-magenta">{erro}</p>}
        <p className="mb-1 text-sm font-bold text-text-muted">Livres</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {AVATARES_NORMAIS.map((id) => (
            <button key={id} onClick={() => escolher(id)} aria-pressed={user?.avatar === id}
              className={`rounded-full ring-2 transition ${user?.avatar === id ? 'ring-pop-cyan' : 'ring-transparent hover:ring-ink-600'}`}>
              <AvatarSvg id={id} size={44} />
            </button>
          ))}
        </div>
        <p className="mb-1 mt-4 text-sm font-bold text-text-muted">🔒 Especiais — conquiste nos rankings ou com fichas</p>
        <div className="grid grid-cols-6 gap-2 opacity-50 sm:grid-cols-10">
          {bloqueados.map((id) => (
            <div key={id} className="relative rounded-full grayscale" title="bloqueado">
              <AvatarSvg id={id} size={44} />
              <span className="absolute inset-0 grid place-items-center text-sm">🔒</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Header — avatar + botão "Meus avatares"** — em `Header.tsx`:
  - imports: `useState`, `AvatarSvg`, `MeusAvataresModal`.
  - `const [avatares, setAvatares] = useState(false)`.
  - no bloco `user ?`, ANTES do `<Link to="/mesa">`, adicionar o botão:

```tsx
              <button onClick={() => setAvatares(true)} className="btn-pop px-3 py-2 text-sm text-text hover:text-pop-cyan">
                Meus avatares
              </button>
```
  - trocar o `<span>` do nome para incluir o avatar antes:

```tsx
              <span className="hidden items-center gap-2 sm:flex" title={user.displayName}>
                <AvatarSvg id={user.avatar} size={30} />
                <span className="max-w-40 truncate text-sm text-text-muted">
                  {user.displayName}
                  {user.isGuest && <span className="ml-1 text-xs font-bold text-pop-yellow">· convidado</span>}
                </span>
              </span>
```
  - antes de fechar o `</header>`, montar o modal: `{avatares && <MeusAvataresModal onClose={() => setAvatares(false)} />}`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MeusAvataresModal.tsx frontend/src/components/Header.tsx frontend/src/lib/auth.tsx
git commit -m "feat(avatares): header com avatar + menu Meus avatares (normais livres, especiais bloqueados)"
```

---

### Task 9: Modal pulável de escolha ao logar (contas antigas)

**Files:**
- Modify: `frontend/src/pages/Mesa.tsx` (dispara o modal quando `user && !user.avatar? não` — ver regra)

**Interfaces:**
- Consumes: `useAuth` (`user`, `setAvatar`), `api`, `MeusAvataresModal`? Não — usa um modal simples próprio de boas-vindas com os 20 normais. Reusa a mesma grade do modal.

Regra de exibição: mostrar UMA vez para contas registradas cujo modal ainda não foi visto. Como não temos `avatarPromptedAt` no `UserPublic`, o gatilho no cliente é: primeira vez que a Mesa monta na sessão E `!localStorage['mp_avatar_prompt']`. Ao escolher OU fechar, chama `POST /api/me/avatar/prompt-visto` e grava a flag local. (Servidor guarda `avatarPromptedAt` para consistência futura; o cliente usa a flag local para não repetir na sessão.)

- [ ] **Step 1: Modal de boas-vindas** — em `Mesa.tsx`:
  - imports: `useState`, `useEffect`, `AvatarSvg`, `AVATARES_NORMAIS`, `api`, `useAuth` (já tem).
  - estado: `const [escolher, setEscolher] = useState(false)`.
  - efeito (mostra uma vez, contas não-convidado):

```tsx
  useEffect(() => {
    if (user && !user.isGuest && !localStorage.getItem('mp_avatar_prompt')) setEscolher(true)
  }, [user])
  function fecharPrompt(id?: string) {
    localStorage.setItem('mp_avatar_prompt', '1')
    void api('/api/me/avatar/prompt-visto', { method: 'POST' }).catch(() => {})
    if (id) { void api('/api/me/avatar', { method: 'PUT', body: { id } }).then(() => setAvatar(id)).catch(() => {}) }
    setEscolher(false)
  }
```
  (pegar `setAvatar` do `useAuth`.)
  - no JSX, renderizar o modal quando `escolher`: título "Escolha seu avatar", subtítulo "dá pra trocar depois em Meus avatares", grade dos 20 normais chamando `fecharPrompt(id)`, e um botão "Agora não" chamando `fecharPrompt()`.

```tsx
      {escolher && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/80 p-4" onClick={() => fecharPrompt()}>
          <div className="card w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-extrabold">Escolha seu avatar 🎭</h2>
            <p className="mb-3 text-sm text-text-muted">Dá para trocar quando quiser em “Meus avatares”.</p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
              {AVATARES_NORMAIS.map((id) => (
                <button key={id} onClick={() => fecharPrompt(id)} className="rounded-full ring-2 ring-transparent transition hover:ring-pop-cyan">
                  <AvatarSvg id={id} size={44} />
                </button>
              ))}
            </div>
            <button onClick={() => fecharPrompt()} className="btn-pop mt-4 px-4 py-2 text-sm ring-1 ring-ink-700">Agora não</button>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w frontend`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Mesa.tsx
git commit -m "feat(avatares): modal pulavel de escolha de avatar ao logar (uma vez)"
```

---

### Task 10: Exibir avatar nas listas de jogadores e rankings

**Files:**
- Modify: `frontend/src/pages/Mesa.tsx` (componente `RoomPeople`) e onde houver lista de jogadores/nome que já receba `UserPublic`/nome.
- Modify: rankings do admin/leaderboard que exibem usuários, se o dado do avatar estiver disponível.

**Interfaces:**
- Consumes: `AvatarSvg`, o campo `avatar` já presente em `UserPublic` (Task 2). Onde a lista só tem `displayName` (sem `avatar`), exibir o avatar derivado do nome como fallback (`<AvatarSvg id={null} />` cai no fallback determinístico) — coerência visual sem exigir mudança de API nesta fase.

- [ ] **Step 1: `RoomPeople`** — em `Mesa.tsx`, no componente `RoomPeople`, trocar o avatar-inicial (a bolinha com a inicial) por `<AvatarSvg id={/* avatar do jogador se disponível, senão o nome como seed */ null} size={22} />`. Onde só há o nome, usar `paramsFromId(nome)` via `AvatarSvg id={nome}` para um avatar estável por nome.

- [ ] **Step 2: Rankings** — nas telas de ranking que listam `displayName`, adicionar `<AvatarSvg id={row.avatar ?? row.displayName} size={24} />` à esquerda do nome (usar `row.avatar` quando a API já o fornecer; senão o nome como seed).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w frontend`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Mesa.tsx
git commit -m "feat(avatares): avatar nas listas de jogadores e rankings"
```

---

### Task 11: Suíte completa, demo, pacotes, CLAUDE.md, push

**Files:**
- Modify: `CLAUDE.md` (ESTADO ATUAL — entrada da Fase A)

- [ ] **Step 1: Typecheck + testes completos**

Run: `npm run typecheck -w shared -w backend -w frontend && npx vitest run --no-file-parallelism`
Expected: tudo PASS (inclui os novos testes de avatares).

- [ ] **Step 2: Demo real (Playwright)** — subir backend+frontend; roteiro: (a) cadastrar escolhendo um avatar → o header mostra o avatar escolhido; (b) abrir "Meus avatares" → trocar por outro normal → header atualiza; verificar que os especiais aparecem bloqueados (🔒); (c) simular conta antiga (limpar `localStorage['mp_avatar_prompt']`) → o modal pulável aparece uma vez e some após escolher/pular; (d) entrar como convidado → header mostra um avatar normal. Salvar capturas no scratchpad e conferir.

- [ ] **Step 3: Regenerar pacotes**

Run: `npm run installer && npm run wsrta`
Expected: 3 zips em `releases/` sem erro.

- [ ] **Step 4: Atualizar CLAUDE.md** — adicionar no topo do ESTADO ATUAL uma entrada resumindo a Fase A (gerador procedural, campo `User.avatar`, cadastro/login/convidado, "Meus avatares", especiais bloqueados até C/D) + LIÇÃO relevante.

- [ ] **Step 5: Commit + push**

```bash
git add -A
git commit -m "feat(avatares): Fase A entregue (gerador, escolha, Meus avatares); pacotes + CLAUDE.md"
git push origin main
```

---

## Self-Review (feito)

- **Cobertura do spec:** gerador (T1), UserPublic.avatar (T2), migração (T3), cadastro+convidado (T4), endpoints PUT/prompt (T5), AvatarSvg (T6), cadastro picker (T7), header+Meus avatares (T8), modal login pulável (T9), exibição salas/rankings (T10), entrega (T11). Especiais/super gerados mas bloqueados (T5 recusa, T8 mostra 🔒). ✓
- **Placeholders:** nenhum passo "TODO/depois" — todo passo de código traz o código. ✓
- **Consistência de tipos:** `paramsFromId`/`AvatarParams`/`avatarTier`/`ehAvatarValido`/`AVATARES_NORMAIS`/`avatarAleatorioNormal` idênticos entre T1 e consumidores (T4–T10). `UserPublic.avatar` (T2) usado em T8/T10. Endpoints `PUT /api/me/avatar` e `POST /api/me/avatar/prompt-visto` iguais em T5/T8/T9. ✓
