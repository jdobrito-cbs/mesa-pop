# Contexto de build: raiz do monorepo (ver docker-compose.yml)
FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --workspace shared --include-workspace-root=false

COPY shared/ shared/
COPY frontend/ frontend/
COPY tsconfig.base.json ./

WORKDIR /app/frontend
RUN npm run build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
