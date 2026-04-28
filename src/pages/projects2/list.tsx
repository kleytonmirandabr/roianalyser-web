/**
 * Lista de Projetos NOVO (Sprint 4 Batch B).
 * Consome /api/projects2. Não confundir com pages/projects/list.tsx (legacy).
 */

import { BarChart3, Plus, Rocket } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useProjects2 } from '@/features/projects2/hooks/use-projects'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { ProjectFormSheet } from '@/features/projects2/components/project-form-sheet'
import { Combobox } from '@/shared/ui/combobox'
import { Skeleton } from '@/shared/ui/skeleton'

function fmtDate(s: string | null) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('pt-BR') } catch { return s } }

function statusColor(s: ProjectStatus): string {
  switch (s) {
    case 'execution': return 'bg-blue-100 text-blue-800'
    case 'done':      return 'bg-emerald-100 text-emerald-800'
    case 'paused':    return 'bg-amber-100 text-amber-800'
    case 'cancelled': return 'bg-rose-100 text-rose-800'
    case 'planning':
    default:          return 'bg-slate-100 text-slate-700'
  }
}

function daysLate(plannedEnd: string | null, status: ProjectStatus): number | null {
  if (!plannedEnd || status === 'done' || status === 'cancelled') return null
  const target = new Date(plannedEnd).getTime()
  const today = new Date().getTime()
  const days = Math.floor((today - target) / 86400000)
  return days > 0 ? days : null
}

export function Projects2ListPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as ProjectStatus) || 'all'
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(initialStatus)

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

  const { data, isLoading, error } = useProjects2()

  const items = useMemo(() => {
    if (!data) return []
    return statusFilter === 'all' ? data : data.filter(p => p.status === statusFilter)
  }, [data, statusFilter])

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'Todos os status' },
    ...PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS_LABELS[s] })),
  ], [])

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Projetos</h1>
            <p className="text-sm text-muted-foreground">
              Execução operacional — cronograma, marcos, time alocado
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/projects-v2/dashboard">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link to="/projects-v2/new">
              <Plus className="h-4 w-4" />
              Novo projeto
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
              onChange={(v) => setStatusFilter((v as ProjectStatus | 'all') || 'all')}
              options={statusOptions}
              placeholder="Status"
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'projeto' : 'projetos'}
          </span>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {!isLoading && items.length === 0 && !error && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum projeto encontrado.
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Progresso</th>
                <th className="px-4 py-3 font-medium">Cronograma</th>
                <th className="px-4 py-3 font-medium">Saúde</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => {
                const late = daysLate(p.plannedEnd, p.status)
                return (
                  <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.projectCode}</td>
                    <td className="px-4 py-3">
                      <Link to={`/projects-v2/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(p.status)}`}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.progressPct.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(p.plannedStart)} → {fmtDate(p.plannedEnd)}</td>
                    <td className="px-4 py-3">
                      {late ? (
                        <span className="text-rose-700 font-medium">⚠ atraso {late}d</span>
                      ) : p.status === 'execution' ? (
                        <span className="text-emerald-700">no prazo</span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    <ProjectFormSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
