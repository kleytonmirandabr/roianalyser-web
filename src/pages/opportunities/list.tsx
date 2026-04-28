import { Plus, BarChart3 } from 'lucide-react'
import { OpportunityFormSheet } from '@/features/opportunities/components/opportunity-form-sheet'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrencyShort, formatDate } from '@/shared/lib/format'

export function OpportunitiesListPage() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('statusId') || 'all'
  const [statusFilter, setStatusFilter] = useState<string>(initial)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: items = [], isLoading } = useOpportunities(
    statusFilter !== 'all' ? { statusId: statusFilter } : {},
  )
  const { data: statuses = [] } = useOpportunityStatuses()

  const statusById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; category: string | null }>()
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color, category: s.category })
    return m
  }, [statuses])

  function setStatus(v: string) {
    setStatusFilter(v)
    if (v === 'all') params.delete('statusId')
    else params.set('statusId', v)
    setParams(params)
  }

  const statusOptions = [
    { value: 'all', label: 'Todos os status' },
    ...statuses.filter(s => s.active).map(s => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Funil comercial — leads em movimento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/opportunities/dashboard"><BarChart3 className="h-4 w-4 mr-2" /> Dashboard</Link></Button>
          <Button onClick={() => setDrawerOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova oportunidade</Button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Filtro:</span>
            <Combobox options={statusOptions} value={statusFilter} onChange={setStatus} />
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{items.length} oportunidades</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-2/3" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade nesse filtro.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Valor estimado</th>
                <th className="px-4 py-2">Fechamento</th>
                <th className="px-4 py-2">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {items.map((op) => {
                const st = op.statusId ? statusById.get(op.statusId) : null
                return (
                  <tr key={op.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2"><Link to={`/opportunities/${op.id}`} className="text-primary hover:underline">{op.name}</Link></td>
                    <td className="px-4 py-2">
                      {st ? (
                        <span className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: (st.color || '#6b7280') + '22', color: st.color || '#6b7280' }}>
                          {st.name}
                        </span>
                      ) : (<span className="text-muted-foreground">—</span>)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{op.estimatedValue != null ? formatCurrencyShort(op.estimatedValue, op.currency) : '—'}</td>
                    <td className="px-4 py-2 text-xs">{op.expectedCloseDate ? formatDate(op.expectedCloseDate) : '—'}</td>
                    <td className="px-4 py-2 text-xs">{formatDate(op.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
      <OpportunityFormSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    
    </div>
  )
}
