#!/usr/bin/env bash
# CUTOVER: troca o React (/v2/) para a raiz (/) e move o vanilla para /legacy/.
#
# Antes de rodar, GARANTA QUE:
#   - O React em /v2/ está funcionando perfeitamente.
#   - Você comparou números do Resumo & Gráfico React vs vanilla com /diag/:id.
#   - Você tem um plano de rollback (este script faz backup, mas teste antes).
#
# O que faz:
#   1. Backup do nginx config atual em /var/backups/nginx/
#   2. Reescreve o server block do nginx para:
#        - location /         → React (/var/www/roianalyser-web/dist)
#        - location /legacy/  → vanilla (/home/ubuntu/roianalyser, antigo root)
#        - location /api/     → backend (mantém)
#   3. Build do React com VITE_BASE_PATH=/ (sem prefixo)
#   4. Deploy do build novo
#
# Uso:
#   bash deploy/cutover.sh   # interativo, pede confirmação
#
# Rollback (se algo der errado):
#   sudo cp $(ls -t /var/backups/nginx/roi-analyzer.bak-* | head -1) /etc/nginx/sites-enabled/roi-analyzer
#   sudo nginx -t && sudo systemctl reload nginx

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${INSTANCE_ID:-i-03506c604c5b8b3b3}"
S3_BUCKET="${S3_BUCKET:-roianalyser-deploys-353452028882}"

cd "$(dirname "$0")/.."

echo "================================================="
echo "  CUTOVER: React /v2/ → /  (vanilla → /legacy/)"
echo "================================================="
echo
echo "Esta operação reescreve o nginx config do EC2."
echo "URL produção: http://107.20.164.229/"
echo
read -p "Tem certeza? Digite 'SIM' para continuar: " confirm
if [ "$confirm" != "SIM" ]; then
  echo "Abortado."
  exit 0
fi

echo
echo "==> [1/4] Build React com base path /"
VITE_BASE_PATH=/ npm run build

echo
echo "==> [2/4] Empacotando e subindo build"
TS=$(date +%Y%m%d-%H%M%S)
TAR="/tmp/roi-web-cutover-$TS.tar.gz"
tar -czf "$TAR" -C dist .
aws s3 cp "$TAR" "s3://$S3_BUCKET/builds/cutover-$TS.tar.gz" --region "$REGION"

PRESIGNED_BUILD=$(aws s3 presign "s3://$S3_BUCKET/builds/cutover-$TS.tar.gz" --expires-in 3600 --region "$REGION")

echo
echo "==> [3/4] Subindo nginx config novo"
# Cria a config nova local
cat > /tmp/roi-analyzer-cutover.conf <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;

    # API proxy (mantém)
    location /api/ {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 10m;
    }

    # === REACT (novo padrão na raiz) ===
    root /var/www/roianalyser-web/dist;
    index index.html;

    # Assets com hash → cache forte
    location ~* \.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA fallback do React
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # === VANILLA (rebaixado para /legacy/) ===
    location /legacy/ {
        alias /home/ubuntu/roianalyser/;
        index index.html;
        try_files $uri $uri/ /legacy/index.html;
    }
    location = /legacy {
        return 301 /legacy/;
    }

    # Bloqueia arquivos ocultos
    location ~ /\. {
        deny all;
        return 404;
    }
}
NGINX

aws s3 cp /tmp/roi-analyzer-cutover.conf "s3://$S3_BUCKET/nginx/cutover-$TS.conf" --region "$REGION"
PRESIGNED_NGINX=$(aws s3 presign "s3://$S3_BUCKET/nginx/cutover-$TS.conf" --expires-in 3600 --region "$REGION")

echo
echo "==> [4/4] Aplicando no EC2 via SSM"
cat > /tmp/cutover-ssm.json <<JSON
{
  "commands": [
    "set -e",
    "ORIG=/etc/nginx/sites-enabled/roi-analyzer",
    "sudo mkdir -p /var/backups/nginx",
    "sudo cp \$ORIG /var/backups/nginx/roi-analyzer.bak-pre-cutover-\$(date +%s)",
    "echo '--- Backup feito ---'",
    "curl -fsSL '$PRESIGNED_NGINX' -o /tmp/roi-analyzer-cutover.conf",
    "curl -fsSL '$PRESIGNED_BUILD' -o /tmp/cutover-build.tar.gz",
    "echo '--- Aplicando build novo ---'",
    "sudo rm -rf /var/www/roianalyser-web/dist/*",
    "sudo tar -xzf /tmp/cutover-build.tar.gz -C /var/www/roianalyser-web/dist/",
    "sudo chown -R www-data:www-data /var/www/roianalyser-web",
    "echo '--- Aplicando nginx novo ---'",
    "sudo cp /tmp/roi-analyzer-cutover.conf \$ORIG",
    "sudo nginx -t",
    "sudo systemctl reload nginx",
    "echo '=== CUTOVER OK ==='",
    "date"
  ]
}
JSON

CMD_ID=$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters file:///tmp/cutover-ssm.json \
  --comment "CUTOVER React→/" \
  --query 'Command.CommandId' --output text)

echo "    CommandId: $CMD_ID"
echo "    Aguardando (10s)..."
sleep 10

aws ssm get-command-invocation \
  --region "$REGION" \
  --command-id "$CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --query '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
  --output json

echo
echo "================================================="
echo "  Se Status='Success': React está em /"
echo "    URL nova:    http://107.20.164.229/"
echo "    Vanilla em:  http://107.20.164.229/legacy/"
echo
echo "  Se algo deu errado, ROLLBACK:"
echo "    aws ssm send-command --region $REGION --instance-ids $INSTANCE_ID \\"
echo "      --document-name AWS-RunShellScript --parameters \\"
echo "      'commands=[\"sudo cp \$(ls -t /var/backups/nginx/roi-analyzer.bak-pre-cutover-* | head -1) /etc/nginx/sites-enabled/roi-analyzer\",\"sudo nginx -t && sudo systemctl reload nginx\"]'"
echo "================================================="
