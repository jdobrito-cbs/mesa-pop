#!/usr/bin/env bash
# =============================================================================
# Mesa Pop — instalador self-hosted
#
# Requisitos: Linux com Docker + Docker Compose v2.
# Uso:
#   ./install.sh                 # instala em http://localhost
#   ./install.sh meu-servidor.com   # instala apontando para esse host/IP
#
# O que ele faz:
#   1. confere Docker e Compose;
#   2. cria o .env com segredos fortes gerados na hora (se ainda não existir);
#   3. constrói e sobe o stack completo (Postgres + backend + site);
#   4. espera a API responder e aplica migrações + seed (feito no boot);
#   5. mostra endereço e credenciais do admin.
# Rodar de novo = atualizar: reconstrói as imagens mantendo o banco (volume).
# =============================================================================
set -euo pipefail

HOST_ADDR="${1:-localhost}"
SITE_URL="http://${HOST_ADDR}:8080"
API_URL="http://${HOST_ADDR}:3001"

say()  { printf '\033[1;35m[mesa pop]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 não encontrado (plugin 'docker compose')."
docker info >/dev/null 2>&1 || fail "O daemon do Docker não está acessível (permissão? serviço parado?)."

gera_segredo() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [ ! -f .env ]; then
  say "Criando .env com segredos gerados na hora…"
  DB_PASS="$(gera_segredo | cut -c1-24)"
  JWT_A="$(gera_segredo)"
  JWT_R="$(gera_segredo)"
  ADMIN_PASS="Pop@$(gera_segredo | cut -c1-12)"
  cat > .env <<EOF
POSTGRES_USER=mesapop
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=mesapop
DATABASE_URL=postgresql://mesapop:${DB_PASS}@db:5432/mesapop

PORT=3001
HOST=0.0.0.0
JWT_ACCESS_SECRET=${JWT_A}
JWT_REFRESH_SECRET=${JWT_R}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
CORS_ORIGIN=${SITE_URL}
COOKIE_SECURE=false

ADMIN_EMAIL=admin@mesapop.local
ADMIN_NAME=Administrador
ADMIN_PASSWORD=${ADMIN_PASS}

VITE_API_URL=${API_URL}

VITE_ADSENSE_CLIENT=
VITE_ADSENSE_SLOT=
EOF
  say ".env criado. Senha do admin: ${ADMIN_PASS} (guarde! também está no .env)"
else
  say ".env já existe — mantendo suas configurações."
fi

say "Construindo e subindo o stack (Postgres + backend + site)…"
docker compose --profile full up -d --build

say "Esperando a API ficar de pé em ${API_URL} …"
for i in $(seq 1 60); do
  if curl -fsS "${API_URL}/api/games" >/dev/null 2>&1; then
    say "API no ar! (migrações e seed rodam automaticamente no boot)"
    break
  fi
  [ "$i" = "60" ] && fail "A API não respondeu em 2 minutos. Veja: docker compose logs backend"
  sleep 2
done

ADMIN_EMAIL_ATUAL="$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
say "──────────────────────────────────────────────"
say "✅ Mesa Pop instalado!"
say "   Site:  ${SITE_URL}"
say "   Admin: ${ADMIN_EMAIL_ATUAL} (senha no .env → ADMIN_PASSWORD)"
say "   Logs:  docker compose logs -f"
say "   Parar: docker compose --profile full down"
say "──────────────────────────────────────────────"
