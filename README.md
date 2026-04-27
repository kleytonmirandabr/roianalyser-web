# roi-analyzer-web

Frontend do **RoiAnalyser** em React + TypeScript — reescrita em paralelo ao app vanilla atual (`roi-analyzer/`). O backend Node/TypeORM/Postgres permanece o mesmo; este app consome a API REST existente.

## Stack

- **Vite 6+** (build + dev server com HMR)
- **React 19 + TypeScript**
- **Tailwind CSS + shadcn/ui** (design system baseado em componentes copy-paste)
- **TanStack Query** (estado de servidor, cache, refetch)
- **React Router 6** (roteamento)
- **react-i18next** (pt / en / es)
- **react-hook-form + Zod** (formulários e validação)

## Requisitos

- Node 20+ (recomendado Node 22)
- pnpm 9+ (ou npm/yarn, mas pnpm é o padrão do projeto)

## Setup inicial

```bash
# na raiz do projeto
pnpm install

# copie o .env.example e ajuste se precisar
cp .env.example .env
```

## Desenvolvimento

Para desenvolver, suba o backend Node do `roi-analyzer/` em outro terminal:

```bash
# terminal 1 — backend (na pasta roi-analyzer/)
npm run dev:api     # sobe o backend em http://localhost:3030
```

Depois, o frontend React:

```bash
# terminal 2 — frontend (aqui)
pnpm dev            # Vite em http://localhost:5173
```

O Vite faz proxy de `/api/*` para o backend (veja `vite.config.ts`).

## Build

```bash
pnpm build          # gera ./dist pronto para servir no Nginx
pnpm preview        # serve o build localmente para sanity check
```

## Estrutura de pastas

```
src/
├── app/                  # setup global (providers, router, query-client)
│   ├── providers.tsx
│   ├── query-client.ts
│   └── router.tsx
├── features/             # módulos de negócio (Fases 4-7)
│   ├── auth/             # login, 2FA, branding
│   ├── projects/         # módulo ROI (10 views)
│   ├── contracts/        # contratos, planos, status
│   ├── portfolio/        # listagem e filtros
│   ├── catalogs/         # 15 painéis administrativos
│   └── reports/          # relatórios e dashboard
├── pages/                # telas de topo, compostas por features
├── shared/               # código reutilizável entre features
│   ├── api/              # HTTP client autenticado
│   ├── hooks/            # hooks genéricos
│   ├── i18n/             # setup + JSONs de locales
│   ├── lib/              # utilitários (cn, format, etc)
│   └── ui/               # componentes shadcn/ui
├── App.tsx
├── main.tsx
└── index.css             # tokens Tailwind + diretivas base
```

## Adicionar componentes shadcn/ui

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add card
# etc
```

Os componentes são gerados em `src/shared/ui/` (alias `@/shared/ui`).

## Roadmap (plano em fases)

| Fase | Entrega                                              | Status     |
| ---- | ---------------------------------------------------- | ---------- |
| 0    | Scaffolding: Vite, Tailwind, shadcn, Router, Query   | ✅ pronto  |
| 1    | Infra: API client autenticado, guards, hooks de auth | ✅ pronto  |
| 2    | Login + 2FA (TOTP/recovery/email) + forgot/reset     | ✅ pronto  |
| 3    | Shell: sidebar, header, UserMenu, switcher idioma    | ✅ pronto  |
| 4    | Módulo Projeto/ROI — 10 views + motor financeiro     | ✅ pronto  |
| 5    | Contratos/Status/Portfolio                           | ⊖ absorvida pelas Fases 4 e 6 |
| 6    | Catálogos administrativos — 15/15 painéis            | ✅ pronto  |
| 7    | Dashboard + Relatórios + Scheduled reports           | ✅ pronto  |
| 8    | Deploy paralelo `/v2/` (artefatos em `deploy/`)      | ✅ pronto  |
| 9    | Testes de paridade e cutover                         | ⏳ pendente — depende de aplicar deploy |

## Convenções

- Paths absolutos via alias `@/` (configurado em `tsconfig.app.json` e `vite.config.ts`).
- **Nunca** fazer chamada direta a `fetch` — use `@/shared/api/client`.
- Chaves de i18n em estrutura hierárquica (ex.: `auth.login.title`).
- Componentes de UI em `shared/ui/` (shadcn). Componentes de feature em `features/<nome>/components/`.

## Receitas comuns

### Liberar mais um catálogo administrativo

Edite `src/features/catalogs/registry.ts`, encontre o entry com `ready: false`, defina os campos específicos e marque `ready: true`. O `<CatalogDetailPage>` resolve o resto automaticamente.

```ts
{
  slug: 'companies',
  type: 'companies',
  label: 'Empresas',
  description: '…',
  ready: true,
  fields: [
    { key: 'name',  label: 'Nome',   kind: 'text', required: true, showInTable: true },
    { key: 'state', label: 'Estado', kind: 'text', showInTable: true, width: '5rem' },
    { key: 'active', label: 'Ativo', kind: 'boolean' },
  ],
},
```

`kind` aceita: `text` | `number` | `color` | `boolean`.

### Reusar a `<EntryTable>` numa nova view financeira

```tsx
<EntryTable
  rows={rows}
  currency={currency}
  itemLabel="Item"
  valLabel="Valor mensal"
  totalLabel="Total"
  showDiscount={false}    // omite coluna Desc%
  showInicio={false}      // omite coluna Início (mês)
  onChange={setRows}
  onAddRow={() => setRows(r => [...r, makeEntryRow()])}
  onRemoveRow={(key) => setRows(r => r.filter(x => x.__key !== key))}
/>
```

Persista assim:

```ts
update.mutate({
  payload: {
    ...project.payload,
    minhaChave: serializeEntryRows(rows),
  },
})
```

### Estender o motor financeiro

Editar `src/features/projects/lib/financials.ts#buildCashFlow`. Cada bloco do laço `for (let month = 1; …)` adiciona uma componente de receita ou custo no mês. Para incluir uma nova fonte (ex.: nova categoria fixa), adicione a leitura via `readArray` antes do laço e some no `recurringRevenue`/`recurringCost` correspondente.

### Adicionar um endpoint novo do backend

1. Tipos em `src/features/<área>/types.ts`.
2. API client em `src/features/<área>/api.ts` usando `@/shared/api/client`.
3. Hooks TanStack Query em `src/features/<área>/hooks/use-*.ts` com `queryKey` consistente para invalidation.
4. Página em `src/pages/<área>/`.
5. Rota em `src/app/router.tsx` (envolvida pelo `<AppShell>` se for privada).
