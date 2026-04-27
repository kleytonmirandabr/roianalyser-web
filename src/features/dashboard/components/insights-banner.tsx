import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  generateInsights,
  type Insight,
} from '@/features/dashboard/lib/insights'
import type { Project } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { Card, CardContent } from '@/shared/ui/card'

const TONE_CLASS: Record<Insight['tone'], string> = {
  good: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30',
  warn: 'text-amber-700 bg-amber-50 dark:bg-amber-950/30',
  bad: 'text-destructive bg-destructive/10',
  info: 'text-blue-700 bg-blue-50 dark:bg-blue-950/30',
}

const TONE_ICON: Record<Insight['tone'], typeof Info> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  bad: AlertCircle,
  info: Info,
}

export function InsightsBanner({ projects }: { projects: Project[] }) {
  const insights = generateInsights(projects)
  if (insights.length === 0) return null
  return (
    <Card>
      <CardContent className="space-y-1.5 p-3">
        {insights.map((ins) => {
          const Icon = TONE_ICON[ins.tone]
          const inner = (
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                TONE_CLASS[ins.tone],
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{ins.message}</span>
            </div>
          )
          return ins.link ? (
            <Link key={ins.id} to={ins.link} className="block hover:opacity-80">
              {inner}
            </Link>
          ) : (
            <div key={ins.id}>{inner}</div>
          )
        })}
      </CardContent>
    </Card>
  )
}
