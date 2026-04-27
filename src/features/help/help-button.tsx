/**
 * HelpButton — ícone "?" no header global. Click abre Sheet lateral com
 * a ajuda contextual (tópico associado à URL atual). Se não houver tópico
 * pra rota, mostra link pra `/help` central.
 */
import { HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/shared/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

import { resolveTopic } from './help-content'
import { HelpTopicView } from './help-renderer'

export function HelpButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const topic = resolveTopic(location.pathname)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title={t('help.title')}
        aria-label={t('help.title')}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden md:inline">{t('help.title')}</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md md:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {topic ? topic.title : t('help.notFoundTitle')}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            {topic ? (
              <HelpTopicView topic={topic} />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('help.notFoundBody')}
                </p>
                <Button asChild variant="outline">
                  <Link to="/help" onClick={() => setOpen(false)}>
                    {t('help.openCentral')}
                  </Link>
                </Button>
              </div>
            )}
            <div className="mt-6 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link to="/help" onClick={() => setOpen(false)}>
                  {t('help.allTopics')}
                </Link>
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  )
}
