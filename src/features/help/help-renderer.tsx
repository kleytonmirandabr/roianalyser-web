import { ExternalLink, Info, Keyboard, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { HelpSection, HelpTopic } from './help-content'

/**
 * Renderiza um tópico completo: título + summary + atalho pra rota +
 * lista de seções tipadas (parágrafo, lista, dica, atalho de teclado).
 */
export function HelpTopicView({ topic }: { topic: HelpTopic }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{topic.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{topic.summary}</p>
        {topic.path && !topic.path.includes(':') && (
          <Link
            to={topic.path}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('help.openScreen', { path: topic.path })}
          </Link>
        )}
      </div>
      <div className="space-y-3">
        {topic.sections.map((section, i) => (
          <SectionView key={i} section={section} />
        ))}
      </div>
    </div>
  )
}

function SectionView({ section }: { section: HelpSection }) {
  if (section.kind === 'paragraph') {
    return (
      <p className="text-sm leading-relaxed text-foreground">{section.text}</p>
    )
  }
  if (section.kind === 'list') {
    return (
      <ul className="ml-4 list-disc space-y-1 text-sm leading-relaxed text-foreground">
        {section.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    )
  }
  if (section.kind === 'tip') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{section.text}</span>
      </div>
    )
  }
  // shortcut
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <kbd className="inline-flex items-center rounded bg-background px-2 py-0.5 font-mono text-xs font-semibold">
          {section.keys}
        </kbd>
        <span className="ml-2 text-foreground">{section.description}</span>
      </div>
    </div>
  )
}

export { Info } // re-export pra evitar import duplicado em quem usa
