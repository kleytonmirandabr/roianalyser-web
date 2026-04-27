#!/usr/bin/env bash
# Quick deploy do roi-analyzer-web para o EC2 via S3+SSM (URL pré-assinada).
# Uso: bash deploy/quick-deploy.sh   ou   npm run deploy
#
# Requisitos:
#   - Estar na raiz do projeto roi-analyzer-web
#   - AWS CLI configurada com credenciais do IAM cowork-roianalyser-operator
#   - Bucket S3 já criado (roianalyser-deploys-353452028882)
#   - Setup inicial do EC2 já feito (nginx /v2/ block + /var/www/roianalyser-web/dist)

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${INSTANCE_ID:-i-03506c604c5b8b3b3}"
S3_BUCKET="${S3_BUCKET:-roianalyser-deploys-353452028882}"

cd "$(dirname "$0")/.."

echo "==> [1/5] Build (base path / — pós-cutover)"
bash deploy/build.sh

echo
echo "==> [2/5] Empacotando dist/"
TS=$(date +%Y%m%d-%H%M%S)
TAR="/tmp/roi-web-$TS.tar.gz"
tar -czf "$TAR" -C dist .
ls -lh "$TAR"

echo
echo "==> [3/5] Upload pro S3"
aws s3 cp "$TAR" "s3://$S3_BUCKET/builds/roi-web-$TS.tar.gz" --region "$REGION"

echo
echo "==> [4/5] Disparando SSM Send-Command"
PRESIGNED=$(aws s3 presign "s3://$S3_BUCKET/builds/roi-web-$TS.tar.gz" --expires-in 3600 --region "$REGION")

cat > /tmp/deploy-ssm.json <<JSON
{
  "commands": [
    "set -e",
    "curl -fsSL '$PRESIGNED' -o /tmp/roi-web.tar.gz",
    "sudo rm -rf /var/www/roianalyser-web/dist/*",
    "sudo tar -xzf /tmp/roi-web.tar.gz -C /var/www/roianalyser-web/dist/",
    "sudo chown -R www-data:www-data /var/www/roianalyser-web",
    "echo === Deploy OK em \$(date) ==="
  ]
}
JSON

CMD_ID=$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters file:///tmp/deploy-ssm.json \
  --comment "quick-deploy $TS" \
  --query 'Command.CommandId' --output text)

echo "    CommandId: $CMD_ID"
echo "    Aguardando execução (8s)..."
sleep 8

echo
echo "==> [5/5] Verificando resultado"
aws ssm get-command-invocation \
  --region "$REGION" \
  --command-id "$CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --query '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
  --output json

echo
echo "==> Deploy concluído. URL: http://107.20.164.229/"
echo "    Recarregue com Cmd+Shift+R no Chrome para evitar cache."
