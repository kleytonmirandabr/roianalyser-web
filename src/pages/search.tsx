import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProjects } from '@/features/projects/hooks/use-projects'
import {
  matchesQuery,
  parseQuery,
  SEARCH_PRESETS,
} from '@/features/search/lib/search-engine'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

export function SearchPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projects = useProjects()
  const companies = useCatalog('companies')
  const [query, setQuery] = useState('')

  const filter = useMemo(() => parseQuery(query), [query])
  const filtered = useMemo(() => {
    if (!query.trim()) return []
    return (projects.data ?? []).filter((p) =>
      matchesQuery(p, filter, {
        userId: user?.id,
        companies: (companies.data ?? []) as unknown as { name?: string; state?: string }[],
      }),
    )
  }, [query, filter, projects.data, companies.data, user?.id])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('search.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('search.subtitle')}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">
          {t('search.presetsLabel')}:
        </span>
        {SEARCH_PRESETS.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            size="sm"
            onClick={() => setQuery(p.query)}
          >
            {t(p.labelKey)}
          </Button>
        ))}
      </div>

      {/* Sintaxe ajuda */}
      <Card>
        <CardContent className="space-y-1 p-3 text-xs text-muted-foreground">
          <div className="font-semibold uppercase tracking-wide">
            {t('search.syntaxLabel')}
          </div>
          <p>
            <code className="rounded bg-muted px-1">valor:&gt;500k</code> ·{' '}
            <code className="rounded bg-muted px-1">em:SP</code> ·{' '}
            <code className="rounded bg-muted px-1">status:negociacao</code> ·{' '}
            <code className="rounded bg-muted px-1">responsavel:eu</code> ·{' '}
            <code className="rounded bg-muted px-1">atrasado</code> ·{' '}
            <code className="rounded bg-muted px-1">sem-time</code> ·{' '}
            <code className="rounded bg-muted px-1">parado</code>
          </p>
        </CardContent>
      </Card>

      {/* Resultado */}
      {query.trim() === '' ? null : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('search.noResults')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('search.results', { count: filtered.length })}
          </p>
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block rounded-md border border-border p-3 hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.status ?? '—'}
                </span>
              </div>
              {typeof p.clientName === 'string' && (
                <p className="text-xs text-muted-foreground">{p.clientName}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
