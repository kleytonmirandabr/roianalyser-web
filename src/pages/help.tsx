/**
 * /help — Central de ajuda completa.
 *
 * Esquerda: lista de tópicos agrupados por categoria, com busca.
 * Direita: conteúdo do tópico selecionado.
 *
 * Estado da seleção fica em URL (?t=slug) pra ser linkável e voltável.
 */
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
  groupByCategory,
  HELP_TOPICS,
  type HelpTopic,
} from '@/features/help/help-content'
import { HelpTopicView } from '@/features/help/help-renderer'
import { cn } from '@/shared/lib/cn'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

export function HelpPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const slug = params.get('t')
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => groupByCategory(), [])
  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return HELP_TOPICS
    return HELP_TOPICS.filter((tp) => {
      const haystack = `${tp.title} ${tp.summary} ${tp.path}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [search])

  const selected = useMemo<HelpTopic | null>(() => {
    if (slug) return HELP_TOPICS.find((tp) => tp.slug === slug) ?? null
    // Default: primeiro tópico se nada selecionado
    return HELP_TOPICS[0] ?? null
  }, [slug])

  function selectTopic(s: string) {
    const next = new URLSearchParams(params)
    next.set('t', s)
    setParams(next, { replace: true })
  }

  const categoryLabels: Record<HelpTopic['category'], string> = {
    fluxo: t('help.categories.fluxo'),
    projeto: t('help.categories.projeto'),
    admin: t('help.categories.admin'),
    sistema: t('help.categories.sistema'),
  }

  // Quando há busca ativa, mostra lista plana filtrada (ignora agrupamento).
  const showSearchResults = search.trim().length > 0

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('help.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('help.pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Sidebar com índice */}
        <Card className="sticky top-0 h-fit overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('help.searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {showSearchResults ? (
              filteredTopics.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {t('help.noResults')}
                </p>
              ) : (
                filteredTopics.map((tp) => (
                  <TopicLink
                    key={tp.slug}
                    topic={tp}
                    selected={tp.slug === selected?.slug}
                    onClick={() => selectTopic(tp.slug)}
                  />
                ))
              )
            ) : (
              (Object.keys(grouped) as HelpTopic['category'][]).map((cat) => (
                <div key={cat} className="mb-3">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {categoryLabels[cat]}
                  </p>
                  {grouped[cat].map((tp) => (
                    <TopicLink
                      key={tp.slug}
                      topic={tp}
                      selected={tp.slug === selected?.slug}
                      onClick={() => selectTopic(tp.slug)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Conteúdo */}
        <Card className="p-6">
          {selected ? (
            <HelpTopicView topic={selected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('help.selectTopic')}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function TopicLink({
  topic,
  selected,
  onClick,
}: {
  topic: HelpTopic
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        selected
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50',
      )}
    >
      <span className="font-medium">{topic.title}</span>
      <span className="line-clamp-1 text-xs text-muted-foreground">
        {topic.summary}
      </span>
    </button>
  )
}
