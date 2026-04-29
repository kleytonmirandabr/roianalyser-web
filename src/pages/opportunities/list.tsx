/**
 * Lista de Oportunidades — Sprint #198 rich.
 *
 * Features:
 * - Coluna "Atualizada" e "Criada" com data/hora respeitando o TZ do user logado
 * - Filtros inteligentes:
 *     - Busca livre por nome
 *     - Status, Responsável, Empresa, Moeda
 *     - Quick filters: Minhas / Sem responsável / Fecha esta semana / Aberta >30d / Alta prob (≥70%) / Top 5 maiores
 * - Seletor de colunas visíveis (persistido em localStorage por user)
 * - Seleção múltipla com bulk-delete (dialog de motivo obrigatório)
 */
import { Plus, BarChart3, Settings2, Trash2, Search, Filter, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useBulkDeleteOpportunities } from '@/features/opportunities/hooks/use-bulk-delete-opportunities'
import { useDeleteOpportunity } from '@/features/opportunities/hooks/use-delete-opportunity'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { OpportunityFormSheet } from '@/features/opportunities/components/opportunity-form-sheet'
import { DeleteWithReasonDialog } from '@/features/opportunities/components/delete-with-reason-dialog'
import type { Opportunity } from '@/features/opportunities/types'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { ProjectsTabs } from '@/pages/projects/components/projects-tabs'
import { CsvExportButton } from '@/shared/ui/csv-export-button'
import { Pagination, usePagination } from '@/shared/ui/pagination'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrencyShort, formatDateTime, formatDate } from '@/shared/lib/format'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { useUserTimezone } from '@/shared/lib/use-user-timezone'

type ColumnId =
  | 'name' | 'status' | 'company' | 'responsible' | 'currency' | 'value'
  | 'probability' | 'duration' | 'expectedClose' | 'createdAt' | 'updatedAt'

type ColumnDef = { id: ColumnId; label: string; defaultVisible: boolean }

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'name',          label: 'Nome',                 defaultVisible: true  },
  { id: 'status',        label: 'Status',               defaultVisible: true  },
  { id: 'company',       label: 'Empresa',              defaultVisible: true  },
  { id: 'responsible',   label: 'Responsável',          defaultVisible: true  },
  { id: 'currency',      label: 'Moeda',                defaultVisible: false },
  { id: 'value',         label: 'Valor estimado',       defaultVisible: true  },
  { id: 'probability',   label: 'Probabilidade',        defaultVisible: false },
  { id: 'duration',      label: 'Tempo (meses)',        defaultVisible: true  },
  { id: 'expectedClose', label: 'Fechamento previsto',  defaultVisible: true  },
  { id: 'createdAt',     label: 'Criada',               defaultVisible: true  },
  { id: 'updatedAt',     label: 'Atualizada',           defaultVisible: true  },
]

const QUICK_FILTERS = [
  { id: 'mine',         label: 'Minhas' },
  { id: 'unassigned',   label: 'Sem responsável' },
  { id: 'thisweek',     label: 'Fecha esta semana' },
  { id: 'stale30',      label: 'Aberta > 30 dias' },
  { id: 'highprob',     label: 'Alta probabilidade (≥70%)' },
  { id: 'top5',         label: 'Top 5 maiores' },
] as const
type QuickFilterId = typeof QUICK_FILTERS[number]['id']

const CURRENCIES_FILTER = [
  { value: '', label: 'Todas as moedas' },
  { value: 'BRL', label: 'BRL' }, { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' }, { value: 'ARS', label: 'ARS' },
  { value: 'CLP', label: 'CLP' }, { value: 'MXN', label: 'MXN' },
  { value: 'GBP', label: 'GBP' },
]

function loadVisibleColumns(userId: string): Set<ColumnId> {
  try {
    const raw = localStorage.getItem(`opps:cols:${userId}`)
    if (raw) {
      const parsed = JSON.parse(raw) as ColumnId[]
      if (Array.isArray(parsed)) return new Set(parsed)
    }
  } catch { /* ignore */ }
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
}

function saveVisibleColumns(userId: string, cols: Set<ColumnId>): void {
  try {
    localStorage.setItem(`opps:cols:${userId}`, JSON.stringify([...cols]))
  } catch { /* ignore */ }
}

export function OpportunitiesListPage() {
  const { user } = useAuth()
  const tz = useUserTimezone()
  const [params, setParams] = useSearchParams()
  const initialStatus = params.get('statusId') || ''
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)
  const [responsibleFilter, setResponsibleFilter] = useState<string>('')
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [currencyFilter, setCurrencyFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [activeQuick, setActiveQuick] = useState<Set<QuickFilterId>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Opportunity | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingOne, setDeletingOne] = useState<Opportunity | null>(null)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [colsOpen, setColsOpen] = useState(false)
  const [visible, setVisible] = useState<Set<ColumnId>>(() => loadVisibleColumns(String(user?.id ?? '')))

  const { data: items = [], isLoading } = useOpportunities(
    statusFilter ? { statusId: statusFilter } : {},
  )
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: companies = [] } = useCompanies()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const deleteOne = useDeleteOpportunity()
  const bulkDelete = useBulkDeleteOpportunities()

  useEffect(() => { saveVisibleColumns(String(user?.id ?? ''), visible) }, [visible, user])

  const statusById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; category: string | null }>()
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color, category: s.category })
    return m
  }, [statuses])

  const companyById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of (companies as any[])) m.set(String(c.id), c.name)
    return m
  }, [companies])

  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of tenantUsers) {
      if (u.id) m.set(String(u.id), u.name || u.email || '?')
    }
    return m
  }, [tenantUsers])

  function toggleQuick(id: QuickFilterId) {
    const next = new Set(activeQuick)
    if (next.has(id)) next.delete(id); else next.add(id)
    setActiveQuick(next)
  }

  // Apply quick + smart filters in memory
  const filtered = useMemo(() => {
    let arr = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter(o => o.name.toLowerCase().includes(q))
    }
    if (responsibleFilter) arr = arr.filter(o => String(o.responsibleId) === responsibleFilter)
    if (companyFilter) arr = arr.filter(o => String(o.companyId ?? '') === companyFilter)
    if (currencyFilter) arr = arr.filter(o => o.currency === currencyFilter)
    if (activeQuick.has('mine')) arr = arr.filter(o => String(o.responsibleId) === String(user?.id))
    if (activeQuick.has('unassigned')) arr = arr.filter(o => !o.responsibleId)
    if (activeQuick.has('thisweek')) {
      const now = new Date()
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0,0,0,0)
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999)
      arr = arr.filter(o => {
        if (!o.expectedCloseDate) return false
        const d = new Date(o.expectedCloseDate + 'T12:00:00')
        return d >= monday && d <= sunday
      })
    }
    if (activeQuick.has('stale30')) {
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000
      arr = arr.filter(o => new Date(o.createdAt).getTime() < cutoff && !o.wonAt && !o.lostAt)
    }
    if (activeQuick.has('highprob')) {
      arr = arr.filter(o => (o.probability ?? 0) >= 70)
    }
    if (activeQuick.has('top5')) {
      if (!currencyFilter) {
        // Top5 sem moeda → não filtra (UI mostra hint)
      } else {
        return [...arr].sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0)).slice(0, 5)
      }
    }
    // Default ordering: updatedAt DESC
    return [...arr].sort((a, b) => (new Date(b.updatedAt).getTime()) - (new Date(a.updatedAt).getTime()))
  }, [items, search, responsibleFilter, companyFilter, currencyFilter, activeQuick, user])

  // Paginação em cima do filtered
  const pag = usePagination(filtered, 25)
  const visibleRows = pag.paginated

  const allChecked = visibleRows.length > 0 && visibleRows.every(o => selected.has(o.id))
  const someChecked = visibleRows.some(o => selected.has(o.id))

  function toggleAll() {
    const next = new Set(selected)
    if (allChecked) {
      for (const o of visibleRows) next.delete(o.id)
    } else {
      for (const o of visibleRows) next.add(o.id)
    }
    setSelected(next)
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function setStatus(v: string) {
    setStatusFilter(v)
    if (!v) params.delete('statusId'); else params.set('statusId', v)
    setParams(params)
  }

  function clearAllFilters() {
    setStatusFilter(''); setResponsibleFilter(''); setCompanyFilter('')
    setCurrencyFilter(''); setSearch('')
    setActiveQuick(new Set())
    params.delete('statusId'); setParams(params)
  }

  async function handleDeleteOne(input: { reasonId: string; note: string | null }) {
    if (!deletingOne) return
    try {
      await deleteOne.mutateAsync({ id: deletingOne.id, ...input })
      toastSaved('Oportunidade excluída')
      setDeletingOne(null)
    } catch (e) { toastError(e) }
  }

  async function handleBulkDelete(input: { reasonId: string; note: string | null }) {
    try {
      const ids = [...selected]
      const { deleted, skipped } = await bulkDelete.mutateAsync({ ids, ...input })
      toastSaved(`${deleted} excluídas${skipped.length ? ` · ${skipped.length} ignoradas` : ''}`)
      setSelected(new Set())
      setBulkDialogOpen(false)
    } catch (e) { toastError(e) }
  }

  // Totais por moeda (rodapé)
  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of filtered) {
      if (o.estimatedValue == null) continue
      m.set(o.currency, (m.get(o.currency) ?? 0) + o.estimatedValue)
    }
    return [...m.entries()]
  }, [filtered])

  const statusOptions = [{ value: '', label: 'Todos os status' }, ...statuses.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))]
  const responsibleOptions = [{ value: '', label: 'Todos responsáveis' }, ...tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))]
  const companyOptions = [{ value: '', label: 'Todas empresas' }, ...(companies as any[]).map((c: any) => ({ value: String(c.id), label: c.name }))]

  const visCols = ALL_COLUMNS.filter(c => visible.has(c.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Funil comercial — leads em movimento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/opportunities/dashboard"><BarChart3 className="h-4 w-4 mr-2" /> Dashboard</Link></Button>
          <Button onClick={() => { setEditing(null); setDrawerOpen(true) }}><Plus className="h-4 w-4 mr-2" /> Nova oportunidade</Button>
        </div>
      </div>

      <ProjectsTabs />

      {/* Linha 1: busca + filtros principais */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Combobox options={statusOptions} value={statusFilter} onChange={setStatus} />
          <Combobox options={responsibleOptions} value={responsibleFilter} onChange={setResponsibleFilter} />
          <Combobox options={companyOptions} value={companyFilter} onChange={setCompanyFilter} />
        </div>

        {/* Linha 2: moeda + quick filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Rápidos:</span>
          </div>
          <div className="w-44">
            <Combobox options={CURRENCIES_FILTER} value={currencyFilter} onChange={setCurrencyFilter} />
          </div>
          {QUICK_FILTERS.map(qf => (
            <button
              key={qf.id}
              type="button"
              onClick={() => toggleQuick(qf.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeQuick.has(qf.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-input hover:bg-muted/50'
              }`}
            >
              {qf.label}
            </button>
          ))}
          {(statusFilter || responsibleFilter || companyFilter || currencyFilter || search || activeQuick.size > 0) && (
            <Button size="sm" variant="ghost" onClick={clearAllFilters} className="ml-auto"><X className="h-3 w-3 mr-1" /> Limpar</Button>
          )}
        </div>
        {activeQuick.has('top5') && !currencyFilter && (
          <p className="text-xs text-amber-600">⚠ "Top 5 maiores" precisa de uma moeda selecionada (não comparamos valores entre moedas).</p>
        )}
      </Card>

      {/* Toolbar: contagem + bulk + cols selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtered.length} oportunidades</span>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setBulkDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir {selected.size}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="oportunidades"
            rows={filtered}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => r.id },
              { key: 'name', label: 'Nome', getValue: (r) => r.name },
              { key: 'status', label: 'Status', getValue: (r) => (r.statusId ? statusById.get(r.statusId)?.name ?? '' : '') },
              { key: 'company', label: 'Empresa', getValue: (r) => (r.companyId ? companyById.get(String(r.companyId)) ?? '' : '') },
              { key: 'responsible', label: 'Responsável', getValue: (r) => userById.get(String(r.responsibleId)) ?? '' },
              { key: 'currency', label: 'Moeda', getValue: (r) => r.currency },
              { key: 'estimatedValue', label: 'Valor estimado', getValue: (r) => r.estimatedValue ?? '' },
              { key: 'probability', label: 'Probabilidade (%)', getValue: (r) => r.probability ?? '' },
              { key: 'contractDurationMonths', label: 'Tempo (meses)', getValue: (r) => r.contractDurationMonths ?? '' },
              { key: 'expectedCloseDate', label: 'Fechamento previsto', getValue: (r) => r.expectedCloseDate ?? '' },
              { key: 'createdAt', label: 'Criada em', getValue: (r) => r.createdAt },
              { key: 'updatedAt', label: 'Atualizada em', getValue: (r) => r.updatedAt },
              { key: 'createdBy', label: 'Criada por', getValue: (r) => userById.get(String(r.createdBy)) ?? '' },
              { key: 'wonAt', label: 'Ganha em', getValue: (r) => r.wonAt ?? '' },
              { key: 'lostAt', label: 'Perdida em', getValue: (r) => r.lostAt ?? '' },
              { key: 'description', label: 'Descrição', getValue: (r) => r.description ?? '' },
            ]}
          />
        <div className="relative">
          <Button size="sm" variant="outline" onClick={() => setColsOpen(v => !v)}>
            <Settings2 className="h-4 w-4 mr-1" /> Colunas
          </Button>
          {colsOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-popover text-popover-foreground border rounded-md shadow-lg p-3 w-64">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Colunas visíveis</div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1">
                    <Checkbox
                      checked={visible.has(col.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(visible)
                        if (v) next.add(col.id); else next.delete(col.id)
                        setVisible(next)
                      }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setColsOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-2/3" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade nesse filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="px-3 py-2 w-8">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={toggleAll}
                      data-state={someChecked && !allChecked ? 'indeterminate' : undefined}
                    />
                  </th>
                  {visCols.map(col => (
                    <th key={col.id} className="px-3 py-2 whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((op) => {
                  const st = op.statusId ? statusById.get(op.statusId) : null
                  return (
                    <tr key={op.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Checkbox checked={selected.has(op.id)} onCheckedChange={() => toggleOne(op.id)} />
                      </td>
                      {visCols.map(col => {
                        let cell: any = '—'
                        switch (col.id) {
                          case 'name':
                            cell = <Link to={`/opportunities/${op.id}`} className="text-primary hover:underline">{op.name}</Link>; break
                          case 'status':
                            cell = st ? (
                              <span className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs"
                                style={{ backgroundColor: (st.color || '#6b7280') + '22', color: st.color || '#6b7280' }}>
                                {st.name}
                              </span>
                            ) : '—'; break
                          case 'company':
                            cell = op.companyId ? (companyById.get(String(op.companyId)) || '—') : '—'; break
                          case 'responsible':
                            cell = op.responsibleId ? (userById.get(String(op.responsibleId)) || '—') : '—'; break
                          case 'currency':
                            cell = op.currency || '—'; break
                          case 'value':
                            cell = <span className="tabular-nums">{op.estimatedValue != null ? formatCurrencyShort(op.estimatedValue, op.currency) : '—'}</span>; break
                          case 'probability':
                            cell = op.probability != null ? `${op.probability}%` : '—'; break
                          case 'duration':
                            cell = op.contractDurationMonths != null ? `${op.contractDurationMonths} mês${op.contractDurationMonths !== 1 ? 'es' : ''}` : '—'; break
                          case 'expectedClose':
                            cell = op.expectedCloseDate ? formatDate(op.expectedCloseDate) : '—'; break
                          case 'createdAt':
                            cell = <span className="text-xs">{formatDateTime(op.createdAt, tz)}</span>; break
                          case 'updatedAt':
                            cell = <span className="text-xs">{formatDateTime(op.updatedAt, tz)}</span>; break
                        }
                        return <td key={col.id} className="px-3 py-2 whitespace-nowrap">{cell}</td>
                      })}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDeletingOne(op)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {totalsByCurrency.length > 0 && (
                <tfoot className="bg-muted/20 border-t">
                  <tr>
                    <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={visCols.length + 2}>
                      <span className="font-medium">Totais por moeda:</span>{' '}
                      {totalsByCurrency.map(([cur, sum], i) => (
                        <span key={cur} className="ml-3 tabular-nums">
                          {i > 0 ? '· ' : ''}{cur}: {formatCurrencyShort(sum, cur)}
                        </span>
                      ))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {filtered.length > 25 && (
          <div className="border-t p-2">
            <Pagination state={pag} />
          </div>
        )}
      </Card>

      <OpportunityFormSheet open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditing(null) }} initial={editing} />

      <DeleteWithReasonDialog
        open={!!deletingOne}
        onClose={() => setDeletingOne(null)}
        count={1}
        onConfirm={handleDeleteOne}
        pending={deleteOne.isPending}
      />
      <DeleteWithReasonDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        count={selected.size}
        onConfirm={handleBulkDelete}
        pending={bulkDelete.isPending}
      />
    </div>
  )
}
