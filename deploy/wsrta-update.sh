#!/usr/bin/env bash
# =============================================================================
# Mesa Pop - atualizacao (WSRTA e terminal Linux)
#
# Traz o codigo novo desta versao. NAO recria o banco nem o .env: apenas
# atualiza dependencias, aplica migracoes pendentes e recompila o site.
# Roda com DOMAIN e PORT no ambiente (o painel injeta) quando disponivel.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

log(){ printf '\033[1;35m[mesa pop]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js nao encontrado."
command -v npm  >/dev/null 2>&1 || die "npm nao encontrado."
[ -f .env ] || die ".env nao encontrado - rode a instalacao antes de atualizar."

# porta/dominio do deploy atual (o painel injeta; senao mantem o .env)
[ -n "${PORT:-}" ]   && sed -i "s|^PORT=.*|PORT=${PORT}|" .env || true
[ -n "${DOMAIN:-}" ] && sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" .env || true

log "Atualizando dependencias..."
npm ci --include=dev

set -a; . ./.env; set +a
DB_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"

log "Aplicando migracoes do banco..."
DATABASE_URL="$DB_URL" npm run db:generate -w backend
DATABASE_URL="$DB_URL" npm run db:deploy -w backend
DATABASE_URL="$DB_URL" npm run db:seed -w backend

log "Recompilando o site..."
export VITE_API_URL=
npm run build -w frontend

log "Atualizacao concluida."
