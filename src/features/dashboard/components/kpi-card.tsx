import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { Card, CardContent } from '@/shared/ui/card'

type KpiCardProps = {
  label: string
  value: ReactNode
  hint?: string
  icon?: ComponentType<{ className?: string }>
  loading?: boolean
  /** Cor do valor: 'good' verde, 'bad' vermelho, 'warn' laranja. */
  tone?: 'good' | 'bad' | 'warn'
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div
          className={cn(
            'mt-2 text-3xl font-semibold tabular-nums',
            tone === 'good' && 'text-emerald-600',
            tone === 'bad' && 'text-destructive',
            tone === 'warn' && 'text-amber-600',
            !tone && 'text-foreground',
          )}
        >
          {loading ? '—' : value}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  )
}
