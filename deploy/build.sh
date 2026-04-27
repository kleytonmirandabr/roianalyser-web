#!/usr/bin/env bash
# Build de produção do roi-analyzer-web para deploy no EC2 em / (raiz).
#
# PÓS-CUTOVER (2026-04-27): React serve da raiz; vanilla foi pra /legacy/.
# Antes era /v2/ — VITE_BASE_PATH agora é / por default. Pra reverter
# (caso precise voltar a `/v2/`), passe `VITE_BASE_PATH=/v2/` no env.
#
# Uso:
#   bash deploy/build.sh                 # build raiz (default)
#   VITE_BASE_PATH=/v2/ bash deploy/build.sh   # build legado /v2/
#
# Pré-requisitos:
#   - estar na raiz do projeto roi-analyzer-web
#   - node 20+ e npm/pnpm instalados
#   - dependências instaladas (npm install)

set -euo pipefail

cd "$(dirname "$0")/.."

# Default: raiz. Pode ser sobrescrito via env.
BASE_PATH="${VITE_BASE_PATH:-/}"

echo "==> Limpando build anterior"
rm -rf dist

echo "==> Build com VITE_BASE_PATH=$BASE_PATH"
VITE_BASE_PATH="$BASE_PATH" npm run build

echo "==> Verificando output"
if [ ! -f dist/index.html ]; then
  echo "ERRO: dist/index.html não foi gerado." >&2
  exit 1
fi

# Sanity-check: index.html precisa referenciar o BASE_PATH escolhido.
EXPECTED="\"${BASE_PATH%/}/assets/"
if [ "$BASE_PATH" = "/" ]; then EXPECTED='"/assets/'; fi
if ! grep -q "$EXPECTED" dist/index.html; then
  echo "AVISO: dist/index.html não tem referências para $EXPECTED. Conferir VITE_BASE_PATH." >&2
fi

echo "==> Build OK em $(pwd)/dist"
ls -lh dist | head -20
