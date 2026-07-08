#!/usr/bin/env bash
# =============================================================================
# Mesa Pop - remocao (WSRTA)
#
# Roda quando o app e removido pelo painel, no workdir e com o .env
# carregado. Limpa o que a instalacao criou: apaga o banco e o usuario
# do Postgres (derivados do DATABASE_URL do .env). Sem isso, o banco
# antigo persiste e um remover+reinstalar falharia na autenticacao.
# So mexe em banco LOCAL que o app criou; banco externo nao e tocado.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")"

log(){ printf '\033[1;35m[mesa pop]\033[0m %s\n' "$*"; }

# banco gerenciado pelo painel (database: postgres) e apagado pelo WSRTA
DB_MANAGED="app"
[ -f .env ] && DB_MANAGED="$(grep '^DB_MANAGED=' .env | cut -d= -f2-)" && DB_MANAGED="${DB_MANAGED:-app}"
[ "$DB_MANAGED" != "app" ] && { log "Banco gerenciado pelo painel - ele mesmo apaga."; exit 0; }

DB_URL="${DATABASE_URL:-}"
[ -z "$DB_URL" ] && [ -f .env ] && DB_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
[ -z "$DB_URL" ] && { log "Sem DATABASE_URL - nada a remover."; exit 0; }

case "$DB_URL" in
  *@localhost:*|*@127.0.0.1:*) ;;
  *) log "Banco externo - nao sera removido."; exit 0 ;;
esac
command -v psql >/dev/null 2>&1 || { log "psql ausente - nada a remover."; exit 0; }

DB_USER="$(printf '%s' "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')"
DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's|.*/([^/?]+)([?].*)?$|\1|')"

if sudo -n -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  PSQL(){ sudo -u postgres psql "$@"; }
else
  PSQL(){ psql "$@"; }
fi

# encerra conexoes abertas antes de dropar o banco
PSQL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
PSQL -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" || true
PSQL -c "DROP ROLE IF EXISTS \"${DB_USER}\";" || true

log "Removido: banco ${DB_NAME} e usuario ${DB_USER}."
