#!/usr/bin/env bash
# Init + push inicial do roi-analyzer-web pro GitHub.
# Roda UMA vez. Depois você pode apagar este arquivo.
#
# Pré-requisitos: SSH key registrada no GitHub (você já tem, é a mesma
# do roianalyser principal) e repo vazio criado em
# https://github.com/kleytonmirandabr/roianalyser-web

set -e

cd "$(dirname "$0")"

echo "==> Limpando .git anterior (se existir)"
rm -rf .git

echo "==> git init -b main"
git init -b main

git config user.name "Kleyton Miranda"
git config user.email "kleyton.miranda@sodep.com.br"

echo "==> Staging"
git add .

echo "==> Verificando que .env não foi staged"
if git ls-files --cached | grep -E "^\.env$" >/dev/null; then
  echo "ERRO: .env foi staged! Abortando."
  exit 1
fi
echo "    OK"

echo "==> Commit inicial"
git commit -m "initial commit: roi-analyzer-web React SPA

React + Vite + TypeScript + Tailwind + shadcn/ui frontend para o
RoiAnalyser. Mantém backend em http://107.20.164.229/api.

Estado atual:
- 70+ telas, 7 abas admin (filtradas por papel master/admin/user)
- Multitenant via tenant-switcher + X-Active-Tenant header
- Branding com logo cliente -> software fallback no sidebar
- Deploy via deploy/quick-deploy.sh (S3 + SSM)
- Cutover concluido: React serve raiz, vanilla rebaixado para /legacy/"

echo "==> Adicionando remote"
git remote add origin git@github.com:kleytonmirandabr/roianalyser-web.git

echo "==> Push -u origin main"
git push -u origin main

echo
echo "==> OK. Repo no ar:"
echo "    https://github.com/kleytonmirandabr/roianalyser-web"
echo
echo "    Pode apagar este script (setup-git.sh) — não vai precisar de novo."
