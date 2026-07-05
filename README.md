# Mesa Pop 🎉

Plataforma web de jogos casuais — multiplayer e single-player — com salas,
contas de usuário, painel admin e leaderboards. **Self-hosted**: seus dados,
seu servidor.

> Identidade visual, paleta e uso do logo: [STYLE_GUIDE.md](STYLE_GUIDE.md)
> Visão, arquitetura e roadmap por fases: [CLAUDE.md](CLAUDE.md)

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS (jogos em Canvas 2D)
- **Backend**: Node.js + TypeScript + Fastify
- **Banco**: PostgreSQL + Prisma
- **Auth**: JWT (access) + refresh token rotativo em cookie httpOnly, argon2
- **Deploy**: Docker Compose

## Estrutura

```
/shared    tipos, schemas de validação (zod) e catálogo de jogos
/backend   API REST + Prisma + auth + auditoria
/frontend  SPA React (PWA) com a identidade Mesa Pop
/branding  logo (horizontal, empilhado, mono) e ícone em SVG
```

## Rodando em desenvolvimento

Pré-requisitos: Node 20+, Docker.

```bash
cp .env.example .env          # ajuste senhas e segredos
cp .env backend/.env          # Prisma lê o .env do diretório do backend
npm install

docker compose up -d db       # Postgres
npm run db:migrate -w backend # migrações
npm run db:seed -w backend    # admin + catálogo de jogos

npm run dev:backend           # API em http://localhost:3001
npm run dev:frontend          # app em http://localhost:5173 (proxy /api)
```

Admin inicial: definido por `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env`.

## Rodando tudo via Docker (produção self-hosted)

```bash
cp .env.example .env   # defina JWT_ACCESS_SECRET forte e senhas reais
docker compose --profile full up -d --build
```

- App: `http://localhost:8080` (nginx serve o SPA e faz proxy de `/api`)
- O backend aplica migrações e roda o seed automaticamente ao subir.

## Testes

```bash
npm test   # unitários (validação) + integração (auth) — exige Postgres up
```

## Scripts úteis

| Comando | O quê |
|---|---|
| `npm run icons -w frontend` | regenera PNGs do PWA a partir do favicon.svg |
| `npm run typecheck -w <ws>` | typecheck de um workspace |
| `npx prisma studio` (em /backend) | UI do banco |

## Roadmap (fases)

0. ✅ Fundação: monorepo, auth, identidade visual, Docker
1. Painel admin + lobby
2. Esqueleto de salas (WebSocket) + Damas
3. Dominó e One (mão escondida, servidor autoritativo)
4. Engine 2D top-down + shoot'em up single-player + nave
5. Co-op em tempo real
6. Fazenda + Cardume
7. Corrida PvP
8. Restante do catálogo

Detalhes em [CLAUDE.md](CLAUDE.md).
