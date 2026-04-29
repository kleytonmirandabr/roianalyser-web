import { useEffect, useState } from 'react'
import { Bell, Save, BellOff } from 'lucide-react'

import {
  useNotificationPrefs, useUpdateNotificationPrefs,
} from '@/features/notifications/hooks/use-server-notifications'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Skeleton } from '@/shared/ui/skeleton'
import { toastError, toastSaved } from '@/shared/lib/toasts'

const TOGGLES = [
  {
    key: 'notifyTaskCreated' as const,
    title: 'Tarefa criada / atribuída',
    desc: 'Receber email com convite de calendário (ICS) quando uma nova tarefa for atribuída a mim.',
  },
  {
    key: 'notifyTaskOverdue' as const,
    title: 'Tarefa atrasada',
    desc: 'Receber email quando uma das minhas tarefas passar do prazo (1× por tarefa).',
  },
  {
    key: 'notifyTaskReminder' as const,
    title: 'Lembrete antes do prazo',
    desc: 'Receber email no horário configurado em "Lembrete" da tarefa (15min/1h/1dia antes).',
  },
  {
    key: 'notifyDigestMorning' as const,
    title: 'Resumo diário (manhã)',
    desc: 'Email único de manhã com tarefas do dia + atrasadas. Reduz o número de emails individuais.',
  },
]

export function NotificationsPrefsPage() {
  const query = useNotificationPrefs()
  const update = useUpdateNotificationPrefs()
  const [draft, setDraft] = useState({
    notifyTaskCreated: true,
    notifyTaskOverdue: true,
    notifyTaskReminder: true,
    notifyDigestMorning: true,
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (query.data) {
      setDraft({
        notifyTaskCreated: query.data.notifyTaskCreated !== false,
        notifyTaskOverdue: query.data.notifyTaskOverdue !== false,
        notifyTaskReminder: query.data.notifyTaskReminder !== false,
        notifyDigestMorning: query.data.notifyDigestMorning !== false,
      })
      setDirty(false)
    }
  }, [query.data])

  function toggle(key: keyof typeof draft) {
    setDraft(d => ({ ...d, [key]: !d[key] }))
    setDirty(true)
  }

  async function handleSave() {
    try {
      await update.mutateAsync(draft)
      toastSaved('Preferências atualizadas')
      setDirty(false)
    } catch (e) {
      toastError(e)
    }
  }

  const allOff = !draft.notifyTaskCreated && !draft.notifyTaskOverdue && !draft.notifyTaskReminder && !draft.notifyDigestMorning

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6" /> Preferências de Notificação
        </h1>
        <p className="text-sm text-muted-foreground">
          Quais emails de tarefa você quer receber. Mudanças tem efeito imediato — próximos disparos respeitam.
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {TOGGLES.map(t => (
              <label
                key={t.key}
                className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/30"
              >
                <Checkbox
                  checked={draft[t.key]}
                  onCheckedChange={() => toggle(t.key)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {allOff && !query.isLoading && (
        <Card className="border-amber-300">
          <CardContent className="flex items-start gap-2 py-3">
            <BellOff className="h-4 w-4 mt-0.5 text-amber-600" />
            <div className="text-xs text-amber-800">
              Você desligou todas as notificações. Você não receberá emails sobre tarefas — só vai ver no sino do app.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || update.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {update.isPending ? 'Salvando...' : 'Salvar preferências'}
        </Button>
      </div>
    </div>
  )
}
