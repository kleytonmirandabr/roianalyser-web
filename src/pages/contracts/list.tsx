/**
 * Lista de Contratos — módulo isolado (Sprint 3 Batch B).
 *
 * Consome /api/contracts2 (entity nova pós-Phase 0). Não confundir com
 * /api/contracts (legacy ainda usado por ProjectsListPage scope='projects').
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.4.
 */

import { BarChart3, FileText, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useContracts } from '@/features/contracts2/hooks/use-contracts'
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from '@/features/contracts2/types'
import { formatCurrencyShort, formatDate } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { ContractFormSheet } from '@/features/contracts2/components/contract-form-sheet'
import { Combobox } from '@/shared/ui/combobox'
import { Skeleton } from '@/shared/ui/skeleton'

function statusColor(status: ContractStatus): string {
  switch (status) {
    case 'active':            return 'bg-emerald-100 text-emerald-800'
    case 'pending_signature': return 'bg-amber-100 text-amber-800'
    case 'ending_soon':       return 'bg-orange-100 text-orange-800'
    case 'ended':             return 'bg-slate-200 text-slate-700'
    case 'terminated':        return 'bg-rose-100 text-rose-800'
    case 'renewed':           return 'bg-blue-100 text-blue-800'
    case 'drafting':
    default:                  return 'bg-slate-100 text-slate-700'
  }
}

/** Calcula dias até vencimento (positivo = futuro, negativo = passou). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  const today = new Date().getTime()
  return Math.floor((target - today) / (1000 * 60 * 60 * 24))
}

export function ContractsListPage() {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as ContractStatus) || 'all'
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>(initialStatus)

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

  const { data, isLoading, error } = useContracts()

  const filteredItems = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'all') return data
    return data.filter((c) => c.status === statusFilter)
  }, [data, statusFilter])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os status' },
      ...CONTRACT_STATUSES.map((s) => ({
        value: s,
        label: CONTRACT_STATUS_LABELS[s],
      })),
    ],
    [],
  )

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">{t('nav.contracts')}</h1>
            <p className="text-sm text-muted-foreground">
              Gestão jurídica — vigência, renovações, anexos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/contracts/dashboard">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo contrato
          </Button>
        </div>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Filtro:</span>
          <div className="w-64">
            <Combobox
              value={statusFilter}
              onChange={(v) => setStatusFilter((v as ContractStatus | 'all') || 'all')}
              options={statusOptions}
              placeholder="Status"
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? 'contrato' : 'contratos'}
          </span>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar contratos: {(error as Error).message}
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
          Nenhum contrato encontrado.
          {statusFilter === 'all' && (
            <div className="mt-3">
              <Button onClick={() => setDrawerOpen(true)} variant="outline">
                <Plus className="h-4 w-4" />
                Criar primeiro contrato
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
                <th className="px-4 py-3 font-medium">{t('common.fields.number')}</th>
                <th className="px-4 py-3 font-medium">{t('common.fields.name')}</th>
                <th className="px-4 py-3 font-medium">{t('common.fields.status')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('common.fields.totalValue')}</th>
                <th className="px-4 py-3 font-medium">{t('common.fields.validity')}</th>
                <th className="px-4 py-3 font-medium">{t('common.fields.dueDate')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((c) => {
                const days = daysUntil(c.endDate)
                const expiringWarn =
                  c.status === 'active' && days != null && days >= 0 && days <= (c.noticePeriodDays || 30)
                return (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.contractNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/contracts/${c.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(c.status)}`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrencyShort(c.totalValue, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      {days != null && (
                        <span className={expiringWarn ? 'text-amber-700 font-medium' : ''}>
                          {days < 0 ? `vencido há ${-days}d` : days === 0 ? 'hoje' : `em ${days}d`}
                          {expiringWarn && ' ⚠'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    <ContractFormSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
