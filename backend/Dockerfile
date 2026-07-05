# Contexto de build: raiz do monorepo (ver docker-compose.yml)
FROM node:24-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci --workspace backend --workspace shared --include-workspace-root=false

COPY shared/ shared/
COPY backend/ backend/
COPY tsconfig.base.json ./

WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 3001
# Aplica migrações pendentes, roda o seed idempotente e sobe o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && npm start"]
