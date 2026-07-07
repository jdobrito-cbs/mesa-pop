#!/usr/bin/env bash
# =============================================================================
# Mesa Pop - instalacao (WSRTA e terminal Linux)
#
# Roda com DOMAIN e PORT no ambiente (o painel injeta) ou por argumento:
#   bash install.sh                 -> localhost:3001
#   bash install.sh meusite.com 8080
#
# Faz tudo: instala dependencias, cria o banco (senha aleatoria), monta o
# .env, prepara o Prisma (migracoes + seed) e compila o site. O site e a
# API sobem juntos numa porta so (a $PORT), servidos pelo backend.
# Reexecucao mantem o .env e o banco (atualiza apenas porta/dominio).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${DOMAIN:-${1:-localhost}}"
PORT="${PORT:-${2:-3001}}"

log(){ printf '\033[1;35m[mesa pop]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }
rand(){ if command -v openssl >/dev/null 2>&1; then openssl rand -hex "${1:-32}"; else head -c "${1:-32}" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

# ---- dependencias de sistema (best-effort no terminal; no painel ja existem) ----
if ! command -v node >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" = 0 ]; then
    log "Instalando Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    die "Node.js nao encontrado. Instale Node 20+ e rode de novo."
  fi
fi
command -v npm >/dev/null 2>&1 || die "npm nao encontrado."

if ! command -v psql >/dev/null 2>&1 && [ -z "${DATABASE_URL:-}" ]; then
  if command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" = 0 ]; then
    log "Instalando PostgreSQL..."
    apt-get install -y postgresql
    command -v service >/dev/null 2>&1 && service postgresql start || true
  fi
fi

log "Instalando dependencias do projeto..."
npm ci --include=dev

# ---- .env + banco (so na primeira vez) ----
if [ ! -f .env ]; then
  log "Configurando banco de dados e .env..."
  if [ -n "${DATABASE_URL:-}" ]; then
    DB_URL="$DATABASE_URL"
  elif command -v psql >/dev/null 2>&1; then
    DB_NAME="mesapop"; DB_USER="mesapop"; DB_PASS="$(rand 16)"
    if sudo -n -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
      PSQL(){ sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }
    else
      PSQL(){ psql -v ON_ERROR_STOP=1 "$@"; }
    fi
    PSQL -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; END IF; END \$\$;" \
      || die "Nao consegui criar o usuario do banco. Defina DATABASE_URL e rode de novo."
    PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
      || PSQL -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
  else
    die "PostgreSQL (psql) nao encontrado e DATABASE_URL nao definido."
  fi

  cat > .env <<EOF
NODE_ENV=production
PORT=${PORT}
HOST=0.0.0.0
DATABASE_URL=${DB_URL}
JWT_ACCESS_SECRET=$(rand 32)
JWT_REFRESH_SECRET=$(rand 32)
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
CORS_ORIGIN=https://${DOMAIN}
COOKIE_SECURE=true
VITE_ADSENSE_CLIENT=
VITE_ADSENSE_SLOT=
EOF
  log "O admin sera criado na 1a vez que abrir o site (tela de configuracao)."
else
  log ".env encontrado - mantendo credenciais; ajustando porta/dominio."
  sed -i "s|^PORT=.*|PORT=${PORT}|" .env
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" .env
fi

# carrega o .env para os comandos abaixo (DATABASE_URL, ADMIN_*)
set -a; . ./.env; set +a

log "Preparando o banco (client, migracoes, seed)..."
npm run db:generate -w backend
npm run db:deploy -w backend
npm run db:seed -w backend

# SEO: grava o dominio real no robots.txt e no sitemap
if [ "${DOMAIN}" != "localhost" ]; then
  sed -i "s|http://localhost:8080|https://${DOMAIN}|g" frontend/public/robots.txt frontend/public/sitemap.xml 2>/dev/null || true
fi

log "Compilando o site..."
export VITE_API_URL=
npm run build -w frontend

log "Instalacao concluida. O site sobe na porta ${PORT}."
