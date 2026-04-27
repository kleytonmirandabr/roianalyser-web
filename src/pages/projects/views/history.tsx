import {
  ArrowRightLeft,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { UserAvatar } from '@/features/admin/components/user-select'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  readActivityLog,
  type ActivityEventType,
} from '@/features/projects/lib/activity-log'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent } from '@/shared/ui/card'

const EVENT_ICON: Record<ActivityEventType, typeof FileText> = {
  status_change: ArrowRightLeft,
  team_assigned: UserPlus,
  team_removed: UserMinus,
  milestone_added: FileText,
  milestone_completed: CheckCircle2,
  milestone_late: Clock,
  attachment_added: Paperclip,
  forecast_updated: TrendingUp,
  task_assigned: UserPlus,
  comment_added: MessageSquare,
  comment_resolved: CheckCheck,
  approval_requested: ShieldAlert,
  approval_granted: ShieldCheck,
  approval_denied: ShieldX,
  note: MessageSquare,
}

const EVENT_TONE: Record<ActivityEventType, string> = {
  status_change: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  team_assigned: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
  team_removed: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
  milestone_added: 'text-muted-foreground bg-muted',
  milestone_completed: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
  milestone_late: 'text-destructive bg-destructive/10',
  attachment_added: 'text-muted-foreground bg-muted',
  forecast_updated: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
  task_assigned: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
  comment_added: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950',
  comment_resolved: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
  approval_requested: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
  approval_granted: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
  approval_denied: 'text-destructive bg-destructive/10',
  note: 'text-muted-foreground bg-muted',
}

function relativeTime(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return iso
  const diffMs = Date.now() - ts
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) return t('projects.detail.history.justNow')
  if (min < 60) return t('projects.detail.history.minutesAgo', { n: min })
  if (hr < 24) return t('projects.detail.history.hoursAgo', { n: hr })
  if (day < 30) return t('projects.detail.history.daysAgo', { n: day })
  return new Date(iso).toLocaleDateString()
}

export function ProjectHistoryView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)

  const events = useMemo(
    () => readActivityLog(project.data?.payload as Record<string, unknown> | null),
    [project.data],
  )

  if (!params.id) return null

  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {t('projects.detail.history.subtitle')}
      </p>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('projects.detail.history.empty')}
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {events.map((evt) => {
            const Icon = EVENT_ICON[evt.type] ?? MessageSquare
            const tone = EVENT_TONE[evt.type] ?? 'text-muted-foreground bg-muted'
            return (
              <li key={evt.id} className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-sm text-foreground">{evt.message}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {evt.actorName && (
                      <span className="inline-flex items-center gap-1">
                        <UserAvatar name={evt.actorName} size={14} />
                        {evt.actorName}
                      </span>
                    )}
                    <span>{relativeTime(evt.at, t)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
