/**
 * Lista de Oportunidades — módulo isolado (Sprint 2 Batch B).
 *
 * Consome `/api/opportunities` (entity nova pós-Phase 0). Não usa o legacy
 * `/api/contracts`. Lista todos os registros do tenant ativo, filtros em
 * memória (status), navega pro detalhe ao clicar.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.2.
 */

import { BarChart3, Plus, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  type OpportunityStatus,
} from '@/features/opportunities/types'
import { formatCurrencyShort, formatDate } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Skeleton } from '@/shared/ui/skeleton'

function statusColor(status: OpportunityStatus): string {
  switch (status) {
    case 'won':         return 'bg-emerald-100 text-emerald-800'
    case 'lost':        return 'bg-rose-100 text-rose-800'
    case 'cancelled':   return 'bg-slate-100 text-slate-700'
    case 'negotiation': return 'bg-blue-100 text-blue-800'
    case 'proposal':    return 'bg-violet-100 text-violet-800'
    case 'qualified':   return 'bg-sky-100 text-sky-800'
    case 'draft':
    default:            return 'bg-slate-100 text-slate-700'
  }
}

export function OpportunitiesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as OpportunityStatus) || 'all'
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>(initialStatus)

  // Sincroniza filtro com URL pra drill-down do dashboard funcionar
  useEffect(() => {
    if (statusFilter === 'all') {
      if (searchParams.has('status')) {
        const next = new URLSearchParams(searchParams)
        next.delete('status')
        setSearchParams(next, { replace: true })
      }
    } else if (searchParams.get('status') !== statusFilter) {
      const next = new URLSearchParams(searchParams)
      next.set('status', statusFilter)
      setSearchParams(next, { replace: true })
    }
  }, [statusFilter, searchParams, setSearchParams])

  const { data, isLoading, error } = useOpportunities()

  const filteredItems = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'all') return data
    return data.filter((opp) => opp.status === statusFilter)
  }, [data, statusFilter])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os status' },
      ...OPPORTUNITY_STATUSES.map((s) => ({
        value: s,
        label: OPPORTUNITY_STATUS_LABELS[s],
      })),
    ],
    [],
  )

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Oportunidades</h1>
            <p className="text-sm text-muted-foreground">
              Funil comercial — leads em movimento
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/opportunities/dashboard">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link to="/opportunities/new">
              <Plus className="h-4 w-4" />
              Nova oportunidade
            </Link>
          </Button>
        </div>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Filtro:</span>
          <div className="w-64">
            <Combobox
              value={statusFilter}
              onChange={(v) => setStatusFilter((v as OpportunityStatus | 'all') || 'all')}
              options={statusOptions}
              placeholder="Status"
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? 'oportunidade' : 'oportunidades'}
          </span>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar oportunidades: {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && !error && filteredItems.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma oportunidade encontrada.
          {statusFilter === 'all' && (
            <div className="mt-3">
              <Button asChild variant="outline">
                <Link to="/opportunities/new">
                  <Plus className="h-4 w-4" />
                  Criar primeira oportunidade
                </Link>
              </Button>
            </div>
          )}
        </Card>
      )}

      {!isLoading && filteredItems.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Valor estimado</th>
                <th className="px-4 py-3 font-medium">Fechamento</th>
                <th className="px-4 py-3 font-medium">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((opp) => (
                <tr
                  key={opp.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/opportunities/${opp.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {opp.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(opp.status)}`}
                    >
                      {OPPORTUNITY_STATUS_LABELS[opp.status] || opp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrencyShort(opp.estimatedValue, opp.currency)}
                  </td>
                  <td className="px-4 py-3">{formatDate(opp.expectedCloseDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(opp.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
