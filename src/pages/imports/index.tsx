import { Briefcase, ChevronRight, Contact, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/shared/ui/card'

export function ImportsIndexPage() {
  const { t } = useTranslation()
  const items = [
    {
      to: '/imports/companies',
      icon: Briefcase,
      title: t('imports.companies.title'),
      description: t('imports.companies.subtitle'),
    },
    {
      to: '/imports/contacts',
      icon: Contact,
      title: t('imports.contacts.title'),
      description: t('imports.contacts.subtitle'),
    },
    {
      to: '/imports/opportunities',
      icon: Upload,
      title: t('imports.opportunities.title'),
      description: t('imports.opportunities.subtitle'),
    },
  ]
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('imports.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('imports.subtitle')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <Link key={it.to} to={it.to}>
            <Card className="transition-colors hover:border-primary hover:bg-accent/50">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <it.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{it.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {it.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
