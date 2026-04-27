#!/usr/bin/env bash
# Deploy do roi-analyzer-web no EC2 via AWS SSM.
#
# O frontend é servido pelo Nginx do HOST (não containerizado), então só
# precisamos:
#   1. Empacotar ./dist em um tarball.
#   2. Enviar para o EC2 (via S3 ou base64 inline).
#   3. Extrair em /var/www/roianalyser-web/dist/.
#   4. Nginx reload (precisa do bloco /v2/ já incluído na config).
#
# Pré-requisitos:
#   - ./dist gerado (rodar `bash deploy/build.sh` antes)
#   - AWS CLI configurado com credenciais do IAM cowork-roianalyser-operator
#     (ver memory project_production_env.md)
#   - Bloco nginx /v2/ já incluído (deploy/nginx-roianalyser-web.conf) e
#     pasta /var/www/roianalyser-web/ já criada com permissões corretas.
#
# Uso:
#   bash deploy/deploy-ec2.sh
#
# IMPORTANTE: este script NÃO deve ser rodado no sandbox do Cowork (proxy
# bloqueia AWS). Rodar do Mac do Kleyton com credenciais válidas.

set -euo pipefail

cd "$(dirname "$0")/.."

INSTANCE_ID="${INSTANCE_ID:-i-03506c604c5b8b3b3}"
REGION="${AWS_REGION:-us-east-1}"
TARGET_DIR="/var/www/roianalyser-web/dist"
S3_BUCKET="${S3_BUCKET:-}"   # opcional: bucket para o tarball

if [ ! -d dist ]; then
  echo "ERRO: pasta dist/ não existe. Rode 'bash deploy/build.sh' primeiro." >&2
  exit 1
fi

echo "==> Empacotando dist/ → /tmp/roi-web.tar.gz"
TAR_FILE=$(mktemp -t roi-web-XXXXXX.tar.gz)
tar -czf "$TAR_FILE" -C dist .
ls -lh "$TAR_FILE"

if [ -n "$S3_BUCKET" ]; then
  S3_KEY="deploys/roi-web-$(date +%Y%m%d-%H%M%S).tar.gz"
  echo "==> Subindo para s3://$S3_BUCKET/$S3_KEY"
  aws s3 cp "$TAR_FILE" "s3://$S3_BUCKET/$S3_KEY" --region "$REGION"

  echo "==> Disparando SSM Send-Command para baixar e extrair no EC2"
  aws ssm send-command \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "{\"commands\":[\
\"set -e\",\
\"sudo mkdir -p $TARGET_DIR\",\
\"sudo aws s3 cp s3://$S3_BUCKET/$S3_KEY /tmp/roi-web.tar.gz --region $REGION\",\
\"sudo tar -xzf /tmp/roi-web.tar.gz -C $TARGET_DIR\",\
\"sudo chown -R www-data:www-data /var/www/roianalyser-web\",\
\"sudo nginx -t && sudo systemctl reload nginx\",\
\"echo Deploy completo em $(date)\"\
]}" \
    --comment "Deploy roi-analyzer-web /v2/"
else
  echo "ERRO: defina S3_BUCKET= antes de rodar (transferir via base64 inline" >&2
  echo "       é proibido pela convenção do projeto — ver feedback_no_chunking.md)." >&2
  exit 1
fi

echo "==> Deploy disparado. Acompanhe via 'aws ssm list-command-invocations'."
echo "    URL pós-deploy: http://107.20.164.229/v2/"
