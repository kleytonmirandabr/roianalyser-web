import {
  Boxes,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Search,
  UsersRound,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  CATALOG_REGISTRY,
  type CatalogDef,
  type CatalogGroup,
} from '@/features/catalogs/registry'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/cn'

// Definição visual de cada grupo. Ordem aqui = ordem de exibição.
const GROUPS: ReadonlyArray<{
  id: CatalogGroup
  icon: typeof Briefcase
  i18nKey: string
}> = [
  { id: 'crm', icon: Briefcase, i18nKey: 'catalogs.groups.crm' },
  { id: 'project', icon: Wrench, i18nKey: 'catalogs.groups.project' },
  { id: 'items', icon: Boxes, i18nKey: 'catalogs.groups.items' },
  { id: 'people', icon: UsersRound, i18nKey: 'catalogs.groups.people' },
]

export function CatalogsIndexPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isMaster = !!user?.isMaster
  const [filter, setFilter] = useState('')

  // Agrupa catálogos por contexto. Um catálogo sem `group` cai em 'project'
  // (default). Aplica filtro de busca pelo label/descrição.
  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const map: Record<CatalogGroup, CatalogDef[]> = {
      crm: [],
      project: [],
      items: [],
      people: [],
    }
    for (const cat of CATALOG_REGISTRY) {
      // Catálogos consolidados em outras telas (ex: contractFormFields +
      // customFields agora vivem em /admin/contract-form) não aparecem
      // na index, mas a rota /catalogs/:slug ainda funciona.
      if (cat.hidden) continue
      const g = cat.group ?? 'project'
      if (q) {
        const haystack = `${cat.label} ${cat.description}`.toLowerCase()
        if (!haystack.includes(q)) continue
      }
      map[g].push(cat)
    }
    return map
  }, [filter])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('catalogs.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('catalogs.subtitle')}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('catalogs.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>

      {/* Card especial — Form. da Oportunidade. Master-only. Vai pra
          tela dedicada `/catalogs/contract-form` (não usa o detail
          genérico). Mantém visualmente alinhado com os demais cards. */}
      {isMaster && !filter.trim() && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Configuração de formulários
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Link to="/catalogs/contract-form">
              <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
                <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        Formulário da Oportunidade
                      </span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        master
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      Configure quais campos aparecem no cadastro de novos
                      projetos — campos padrão e customizados, visibilidade e
                      obrigatoriedade.
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      )}

      {GROUPS.map((g) => {
        const list = grouped[g.id]
        if (list.length === 0) return null
        const Icon = g.icon
        return (
          <section key={g.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(g.i18nKey)}
              </h2>
              <span className="text-xs text-muted-foreground">
                · {list.length}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((catalog) => (
                <Link
                  key={catalog.slug}
                  to={catalog.ready ? `/catalogs/${catalog.slug}` : '#'}
                  onClick={!catalog.ready ? (e) => e.preventDefault() : undefined}
                  aria-disabled={!catalog.ready}
                  className={cn(!catalog.ready && 'pointer-events-none')}
                >
                  <Card
                    className={cn(
                      'h-full transition-colors',
                      catalog.ready
                        ? 'hover:border-primary hover:bg-accent/50'
                        : 'opacity-60',
                    )}
                  >
                    <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {catalog.label}
                          </span>
                          {!catalog.ready && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t('shell.soon')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {catalog.description}
                        </p>
                      </div>
                      {catalog.ready && (
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {filter.trim() &&
        GROUPS.every((g) => grouped[g.id].length === 0) && (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t('catalogs.noResults', { q: filter })}
          </div>
        )}
    </div>
  )
}
