import { ChevronLeft, BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrencyShort, formatNumberCompact } from '@/shared/lib/format'

export function OpportunitiesDashboardPage() {
  const [, setParams] = useSearchParams()
  const { data: items = [], isLoading } = useOpportunities()
  const { data: statuses = [] } = useOpportunityStatuses()

  const statusById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; category: string | null }>()
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color, category: s.category })
    return m
  }, [statuses])

  const totals = useMemo(() => {
    let count = 0, gain = 0, loss = 0, inProgress = 0, totalValue = 0
    for (const op of items) {
      count++
      const cat = op.statusId ? statusById.get(op.statusId)?.category : null
      if (cat === 'gain') gain++
      else if (cat === 'loss') loss++
      else if (cat === 'in_progress' || cat === 'qualified') inProgress++
      if (op.estimatedValue) totalValue += Number(op.estimatedValue)
    }
    const winRate = (gain + loss) > 0 ? (gain / (gain + loss)) * 100 : 0
    return { count, gain, loss, inProgress, totalValue, winRate }
  }, [items, statusById])

  // Funil: agrupa por status
  const byStatus = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null; count: number; value: number }>()
    for (const op of items) {
      if (!op.statusId) continue
      const st = statusById.get(op.statusId)
      if (!st) continue
      const cur = map.get(op.statusId) || { id: op.statusId, name: st.name, color: st.color, count: 0, value: 0 }
      cur.count += 1
      if (op.estimatedValue) cur.value += Number(op.estimatedValue)
      map.set(op.statusId, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [items, statusById])

  const maxCount = Math.max(1, ...byStatus.map(b => b.count))

  return (
    <div className="space-y-6">
      <Link to="/opportunities" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" /> Lista
      </Link>
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Dashboard — Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Funil comercial · {totals.count} oportunidades no total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Pipeline ativo</div>
          <div className="text-2xl font-bold">{formatCurrencyShort(totals.totalValue, 'BRL')}</div>
          <div className="text-xs text-muted-foreground">{totals.inProgress} em negociação</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Win rate</div>
          <div className="text-2xl font-bold text-green-600">{totals.winRate.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">{totals.gain} ganhas / {totals.loss} perdidas</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Ganhas</div>
          <div className="text-2xl font-bold text-green-600">{totals.gain}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Perdidas</div>
          <div className="text-2xl font-bold text-red-600">{totals.loss}</div>
        </Card>
      </div>

      <Card className="p-6 space-y-3">
        <div>
          <h3 className="font-semibold">Funil comercial</h3>
          <p className="text-xs text-muted-foreground">Volume e valor por status. Clique pra filtrar a lista.</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : byStatus.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Sem oportunidades com status definido.</div>
        ) : (
          <div className="space-y-2">
            {byStatus.map((b) => (
              <button key={b.id} className="w-full text-left"
                onClick={() => { const p = new URLSearchParams(); p.set('statusId', b.id); setParams(p); window.location.href = `/opportunities?statusId=${b.id}` }}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrencyShort(b.value, 'BRL')} · <span className="text-foreground font-semibold">{formatNumberCompact(b.count)}</span>
                  </span>
                </div>
                <div className="h-2 bg-muted/30 rounded">
                  <div className="h-2 rounded transition-all"
                    style={{ width: `${(b.count / maxCount) * 100}%`, backgroundColor: b.color || '#6366f1' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
