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

# SEO: reaplica o dominio real no robots.txt/sitemap.xml (o pacote de update
# traz esses arquivos com localhost; sem isto a atualizacao reverte o sitemap).
# Usa o DOMAIN do painel; sem ele, deriva do CORS_ORIGIN gravado no .env.
SITE_ORIGIN="${DOMAIN:+https://${DOMAIN}}"
if [ -z "$SITE_ORIGIN" ]; then SITE_ORIGIN="${CORS_ORIGIN:-}"; fi
SITE_ORIGIN="${SITE_ORIGIN%%,*}"
if [ -n "$SITE_ORIGIN" ] && [ "$SITE_ORIGIN" != "http://localhost:8080" ]; then
  log "Apontando robots.txt e sitemap.xml para ${SITE_ORIGIN}..."
  sed -i "s|http://localhost:8080|${SITE_ORIGIN}|g" frontend/public/robots.txt frontend/public/sitemap.xml 2>/dev/null || true
fi

log "Recompilando o site..."
export VITE_API_URL=
npm run build -w frontend

log "Atualizacao concluida."
