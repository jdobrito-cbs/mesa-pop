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

# ---- resolve o DATABASE_URL ----
# 3 origens: (1) .env ja existente; (2) o painel injeta DATABASE_URL
# quando "database: postgres" esta no app.md (banco GERENCIADO — o WSRTA
# cria e apaga); (3) nenhum → o proprio app cria um Postgres local.
SLUG="$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9')"; SLUG="${SLUG:-app}"; SLUG="$(printf '%s' "$SLUG" | cut -c1-24)"
if [ -f .env ]; then
  DB_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
  DB_MANAGED="$(grep '^DB_MANAGED=' .env | cut -d= -f2-)"; DB_MANAGED="${DB_MANAGED:-app}"
  log ".env encontrado - reaproveitando o banco; ajustando porta/dominio."
elif [ -n "${DATABASE_URL:-}" ]; then
  DB_URL="$DATABASE_URL"; DB_MANAGED="wsrta"   # banco gerenciado pelo painel
  log "Usando o banco gerenciado pelo painel (DATABASE_URL fornecida)."
else
  DB_URL="postgresql://mp_${SLUG}:$(rand 16)@localhost:5432/mp_${SLUG}"; DB_MANAGED="app"
fi

# ---- Postgres LOCAL que NOS criamos: garante role, SENHA e banco ----
# (quando o painel gerencia o banco, nao mexemos — evita erro de permissao)
if [ "$DB_MANAGED" = "app" ]; then
  case "$DB_URL" in
    *@localhost:*|*@127.0.0.1:*)
      command -v psql >/dev/null 2>&1 || die "PostgreSQL (psql) nao encontrado. Habilite o Postgres no painel (database: postgres) ou informe DATABASE_URL."
      DB_USER="$(printf '%s' "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')"
      DB_PASS="$(printf '%s' "$DB_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
      DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's|.*/([^/?]+)([?].*)?$|\1|')"
      if sudo -n -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
        PSQL(){ sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }
      else
        PSQL(){ psql -v ON_ERROR_STOP=1 "$@"; }
      fi
      PSQL -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN CREATE ROLE \"${DB_USER}\" LOGIN; END IF; END \$\$;" \
        || die "Sem permissao para criar o usuario do banco. Habilite o Postgres no painel (database: postgres)."
      # FORCA a senha a bater com o .env (corrige role pre-existente = causa do P1000)
      PSQL -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASS}';" \
        || die "Sem permissao para definir a senha do usuario ${DB_USER}."
      PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
        || PSQL -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"
      PSQL -c "GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";" >/dev/null 2>&1 || true
      ;;
  esac
fi

# valida a conexao ANTES de migrar (erro claro em vez do P1000 no meio)
if command -v psql >/dev/null 2>&1; then
  psql "$DB_URL" -tAc "SELECT 1" >/dev/null 2>&1 \
    || die "Nao consegui conectar no banco. Confira o PostgreSQL (habilite no painel: database: postgres) ou o DATABASE_URL."
fi

# ---- .env ----
if [ ! -f .env ]; then
  cat > .env <<EOF
NODE_ENV=production
PORT=${PORT}
HOST=0.0.0.0
DATABASE_URL=${DB_URL}
DB_MANAGED=${DB_MANAGED}
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
  sed -i "s|^PORT=.*|PORT=${PORT}|" .env
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" .env
fi

# carrega o .env para os comandos abaixo (DATABASE_URL, ADMIN_*)
set -a; . ./.env; set +a

log "Preparando o banco (client, migracoes, seed)..."
DATABASE_URL="$DB_URL" npm run db:generate -w backend
DATABASE_URL="$DB_URL" npm run db:deploy -w backend
DATABASE_URL="$DB_URL" npm run db:seed -w backend

# SEO: grava o dominio real no robots.txt e no sitemap
if [ "${DOMAIN}" != "localhost" ]; then
  sed -i "s|http://localhost:8080|https://${DOMAIN}|g" frontend/public/robots.txt frontend/public/sitemap.xml 2>/dev/null || true
fi

log "Compilando o site..."
export VITE_API_URL=
npm run build -w frontend

log "Instalacao concluida. O site sobe na porta ${PORT}."
