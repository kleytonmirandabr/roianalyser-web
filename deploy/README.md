# Deploy paralelo do roi-analyzer-web

O React vai conviver com o app vanilla atual. O Nginx do EC2 serve:
- `/` → vanilla (atual)
- `/v2/` → React (novo)
- `/api/*` → backend (sem mudanças)

Domínio único (`http://107.20.164.229/`) — sem subdomínio porque a produção
ainda não tem domínio próprio (ver memória `project_production_env.md`).

## Setup inicial no EC2 (uma vez)

Via SSM, em terminal do Mac com credenciais do IAM cowork-roianalyser-operator:

```bash
aws ssm start-session --target i-03506c604c5b8b3b3 --region us-east-1
```

Dentro da sessão:

```bash
sudo mkdir -p /var/www/roianalyser-web/dist
sudo chown -R www-data:www-data /var/www/roianalyser-web
```

Adicionar o bloco `/v2/` na config do Nginx. O fragmento está em
`deploy/nginx-roianalyser-web.conf`. Inclua dentro do `server { ... }`
existente que serve `roianalyser`. Depois:

```bash
sudo nginx -t           # valida sintaxe
sudo systemctl reload nginx
```

## Build

Na raiz do `roi-analyzer-web`:

```bash
bash deploy/build.sh
```

Gera `dist/` com `base=/v2/` — todas as URLs de assets já apontam para
`/v2/assets/...` e o React Router usa basename `/v2`.

## Deploy

Via SSM (preferível — sem expor SSH):

```bash
S3_BUCKET=seu-bucket-de-deploys bash deploy/deploy-ec2.sh
```

O script:
1. Cria tarball de `dist/`.
2. Sobe para o S3.
3. Manda SSM Send-Command para o EC2 baixar, extrair em
   `/var/www/roianalyser-web/dist/` e dar `nginx -s reload`.

Bucket S3 é necessário porque chunking via base64 inline é proibido pela
convenção do projeto (ver memória `feedback_no_chunking.md`).

## Verificar

Pós-deploy:

```bash
curl -I http://107.20.164.229/v2/
curl -s http://107.20.164.229/v2/index.html | head -10
```

E no browser: `http://107.20.164.229/v2/` — deve carregar o login do React.

## Rollback

Como o vanilla continua intocado em `/`, qualquer problema com o React em
`/v2/` não afeta usuários reais. Para reverter:

```bash
# remover o bloco /v2/ do nginx config + reload
# ou: apagar /var/www/roianalyser-web/dist/* (route 404 no /v2/)
```

## Convivência durante a transição

- **Vanilla (`/`)** continua autoritativo até paridade total da Fase 9.
- **React (`/v2/`)** serve como beta pra você e testers convidados.
- Mesmo backend (`/api/*`) e mesmo banco — login funciona em ambos.
- Quando a paridade fechar, basta inverter: vanilla vai para `/legacy/` (ou
  é desligado) e React assume o `/`.
