# Avatares & economia — Fase A (avatares base) — Design

Data: 2026-07-10 · Projeto: Mesa Pop

## Contexto e faseamento

Pedido do usuário: sistema de avatares (procedurais), cor de peão no Magnata,
fichas + máquina "gumball", e dois rankings gerais com banners. É grande, então
foi decomposto em fases (regra 2 do projeto — uma fase por vez, com OK):

- **Fase A — Avatares (base)** ← este spec.
- **Fase B — Cor do peão no Magnata** (escolher ao entrar).
- **Fase C — Rankings gerais** (pontos somados e tempo de jogo somado) + os dois
  banners na página do usuário; top-10 de cada desbloqueia avatares especiais.
- **Fase D — Fichas + máquina gumball** (acúmulo 1/5min, banner, modal animado,
  gasto por avatares especiais).

Decisões do usuário confirmadas no brainstorming:
- Estilo dos avatares: **bichinhos (fauna estilizada) + personagens**.
- Modal de escolha ao logar (contas antigas): **aparece uma vez, pode pular**.
- Construção **fase a fase**, começando por A.

## Objetivo da Fase A

Fundação de avatares: um gerador procedural em SVG (todos os tiers), o avatar
ativo por usuário, escolha no cadastro/login/convidado, exibição no sistema e o
menu "Meus avatares". Especiais/super são **gerados mas ainda não obteníveis**
(desbloqueio vem em C/D) — aparecem bloqueados.

## Restrição técnica

Nada de imagens externas ou geradas por IA (arte de terceiros / fora do stack).
Tudo é **SVG procedural** no estilo Mesa Pop, determinístico por id/seed —
mesmo padrão dos peões e peças de xadrez já existentes.

## Componentes

### 1) Gerador procedural — `shared/src/avatares.ts`
- Catálogo por tier com ids curtos: normais `n0..n19` (20), especiais `e0..e999`
  (~1000), super `s0..s14` (15). Helpers: `avatarTier(id)`, `ehAvatarValido(id)`,
  `AVATARES_NORMAIS` (lista dos 20 ids).
- `paramsFromId(id)`: params determinísticos via `hashSeed`/`mulberry32`
  (já em `shared/seed.ts`) — espécie/personagem, cor base, cor secundária, olhos,
  expressão, acessório, fundo, moldura. O **tier** aumenta a riqueza:
  - normal: base + olhos + boca (limpo, poucas cores);
  - especial: + acessório + padrão/brilho;
  - super: + moldura animada + efeito (partículas/aura).
- Interface pura (sem React) para o backend poder validar/usar se necessário.

### 2) Componente de render — `frontend/src/components/AvatarSvg.tsx`
- `<AvatarSvg id={...} size={...} />` → desenha o SVG a partir de `paramsFromId`.
- Família de "faces": gato, coruja, raposa, robô, alien, fantasminha, sapo,
  panda, etc. (bichinhos + personagens). Legível de 24px a 128px.
- Fallback: id inválido/ausente → um normal derivado do próprio texto (nunca quebra).

### 3) Dados
- Migração: novo campo `User.avatar String?` (id do avatar ativo) e
  `User.avatarPromptedAt DateTime?` (para o modal de login aparecer só uma vez).
- `UserPublic` (`shared/types.ts`) ganha `avatar: string | null` → trafega em
  rankings, salas, header, etc. `lib/user.ts` (toPublic) passa a incluí-lo.
- Sem tabela de posse nesta fase (especiais só desbloqueiam em C/D).

### 4) Backend
- `PUT /api/me/avatar { id }` (auth): valida `ehAvatarValido(id)` **e** que o
  tier é liberado (Fase A: só `normal`; especial/super → 403 `AVATAR_LOCKED`).
  Grava em `user.avatar`.
- `POST /api/me/avatar/prompt-visto` (auth): marca `avatarPromptedAt=now` (o
  modal de login não repete).
- Registro (`auth.register`): aceita `avatar?` opcional (um dos 20 normais);
  se ausente/ inválido, atribui um normal aleatório.
- Convidado (`auth.guest`): atribui um normal aleatório.
- Guarda genérica: qualquer avatar inválido no banco cai no fallback do render.

### 5) Frontend — fluxos
- **Cadastro** (`Register.tsx`): grade dos 20 normais (um pré-selecionado
  aleatório), envia o id escolhido no register.
- **Login/entrada** (contas antigas sem `avatar` e sem `avatarPromptedAt`):
  `AuthProvider`/uma camada na Mesa abre um modal **pulável** para escolher entre
  os 20; ao escolher OU fechar, chama `prompt-visto`. Quem pula fica com um
  normal aleatório (atribuído no backend ao restaurar sessão se `avatar` for nulo).
- **"Meus avatares"** (novo item no `Header`, à esquerda de "Minha mesa"):
  modal com os 20 normais selecionáveis + especiais/super em preview
  **bloqueado** (cadeado + "conquiste no ranking / com fichas"). Selecionar →
  `PUT /api/me/avatar`.
- **Exibição**: `Header` (avatar + nome), listas de jogadores das salas
  (`RoomPeople`/seat lists) e rankings passam a mostrar `<AvatarSvg>` a partir de
  `user.avatar` no `UserPublic`.

## Escopo / YAGNI (Fase A)
- O gerador já cobre todos os tiers, mas **não há como obter especiais/super**
  nesta fase (sem fichas, sem gumball, sem desbloqueio por ranking). Eles só
  aparecem bloqueados no "Meus avatares".
- Sem alterações no peão do Magnata (Fase B).

## Testes
- `shared`: determinismo (`paramsFromId(id)` estável), `ehAvatarValido`/tiers,
  `AVATARES_NORMAIS` tem 20 ids únicos.
- `backend`: `PUT /api/me/avatar` aceita normal e recusa especial/super (403);
  recusa id inválido; convidado recebe um normal; registro salva o avatar escolhido
  e cai no aleatório sem escolha; `prompt-visto` marca a data.
- Typecheck limpo nos 3 workspaces.

## Demo (Playwright, real)
Cadastrar escolhendo um avatar → header mostra o avatar; abrir "Meus avatares" e
trocar → header atualiza + especiais bloqueados; simular conta antiga → modal
pulável aparece uma vez; convidado entra com um normal aleatório.

## Entrega (regras do projeto)
Testes + demo visual; `npm run installer` e `npm run wsrta`; commit + push
(origin/main). Atualizar o ESTADO ATUAL do CLAUDE.md ao fechar a fase.
