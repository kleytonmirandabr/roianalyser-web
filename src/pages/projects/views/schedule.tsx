import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { MultiUserSelect } from '@/features/admin/components/user-select'
import { GanttChart } from '@/features/projects/components/gantt-chart'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useUpdateMilestone,
} from '@/features/projects/hooks/use-milestones'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  effectiveStatus,
  type Milestone,
  type MilestoneStatus,
} from '@/features/projects/lib/milestones'
import { cn } from '@/shared/lib/cn'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

const STATUS_OPTIONS: MilestoneStatus[] = [
  'pending',
  'in-progress',
  'done',
  'blocked',
]

const STATUS_TONE: Record<MilestoneStatus, string> = {
  pending: 'text-amber-600',
  'in-progress': 'text-blue-600',
  done: 'text-emerald-600',
  late: 'text-destructive',
  blocked: 'text-purple-600',
}

/** Item enriquecido pra exibição: adiciona depth pra indentar sub-tarefas. */
type EnrichedMilestone = Milestone & {
  depth: number
  hasChildren: boolean
}

/**
 * Constrói árvore (ordenada por `order`) e retorna lista flat com depth.
 * Sub-tarefas filhas de um pai expandido aparecem logo abaixo do pai.
 *
 * Quando um milestone tem `parentId` apontando pra um id que não existe
 * na lista (ex: foi deletado), ele é tratado como root pra não sumir.
 */
function flattenTree(
  milestones: Milestone[],
  expanded: Set<string>,
): EnrichedMilestone[] {
  const byId = new Map(milestones.map((m) => [m.id, m]))
  const childrenOf = new Map<string | null, Milestone[]>()
  for (const m of milestones) {
    const parentKey = m.parentId && byId.has(m.parentId) ? m.parentId : null
    const list = childrenOf.get(parentKey) ?? []
    list.push(m)
    childrenOf.set(parentKey, list)
  }
  // Ordena cada nível por order asc.
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order - b.order)
  }

  const out: EnrichedMilestone[] = []
  function walk(parentId: string | null, depth: number) {
    const children = childrenOf.get(parentId) ?? []
    for (const m of children) {
      const has = (childrenOf.get(m.id) ?? []).length > 0
      out.push({ ...m, depth, hasChildren: has })
      if (has && expanded.has(m.id)) {
        walk(m.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return out
}

export function ProjectScheduleView() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const projectId = params.id ?? ''
  const project = useProject(projectId)
  const list = useMilestones(projectId)
  const create = useCreateMilestone(projectId)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)

  const milestones = list.data ?? []

  // Estado de UI
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [showOnlyLate, setShowOnlyLate] = useState(false)

  // Quando carregar primeiro batch, expande todos os pais por default
  // (UX comum em schedule pra ver tudo de cara). Só faz isso uma vez.
  useEffect(() => {
    if (!list.data || list.data.length === 0) return
    setExpanded((prev) => {
      if (prev.size > 0) return prev
      const parents = new Set<string>()
      for (const m of list.data) {
        if (m.parentId) parents.add(m.parentId)
      }
      return parents
    })
  }, [list.data])

  // Aplica filtros (mantém hierarquia visual quando filtro casa em sub-tarefa
  // mas não no pai — pai vira "auto-incluído" pra não quebrar o tree).
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q && !statusFilter && !responsibleFilter && !showOnlyLate) {
      return new Set(milestones.map((m) => m.id))
    }
    const matched = new Set<string>()
    for (const m of milestones) {
      const hay = `${m.title} ${m.description ?? ''}`.toLowerCase()
      if (q && !hay.includes(q)) continue
      if (statusFilter && m.status !== statusFilter) continue
      if (
        responsibleFilter &&
        !(m.responsibleIds ?? []).includes(responsibleFilter)
      ) {
        continue
      }
      if (showOnlyLate && effectiveStatus(m) !== 'late') continue
      matched.add(m.id)
    }
    // Inclui ancestrais dos matched pra preservar hierarquia visual.
    const byId = new Map(milestones.map((m) => [m.id, m]))
    const expandedSet = new Set(matched)
    for (const id of matched) {
      let cur = byId.get(id)?.parentId
      while (cur) {
        expandedSet.add(cur)
        cur = byId.get(cur)?.parentId ?? null
      }
    }
    return expandedSet
  }, [milestones, search, statusFilter, responsibleFilter, showOnlyLate])

  const flat = useMemo(
    () =>
      flattenTree(milestones, expanded).filter((m) => visibleIds.has(m.id)),
    [milestones, expanded, visibleIds],
  )

  // Lista de IDs disponíveis pra dropdown de "depende de" — qualquer outro
  // milestone (não pode depender de si mesmo, mas pode depender de pai/filho).
  const dependencyOptions = useMemo(
    () =>
      milestones.map((m) => ({
        value: m.id,
        label: m.title || '(sem título)',
      })),
    [milestones],
  )

  const responsibleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of milestones) {
      for (const id of m.responsibleIds ?? []) set.add(id)
    }
    return [...set].map((id) => ({ value: id, label: id }))
  }, [milestones])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function patchAndSave(id: string, patch: Partial<Milestone>) {
    try {
      await update.mutateAsync({ id, input: patch })
    } catch (err) {
      toastError(err)
    }
  }

  async function addMilestone(parentId: string | null = null) {
    try {
      await create.mutateAsync({
        title: '',
        status: 'pending',
        parentId,
        order: milestones.filter((m) => m.parentId === parentId).length,
      })
      toastSaved(t('projects.detail.schedule.added'))
    } catch (err) {
      toastError(err)
    }
  }

  async function removeMilestone(m: Milestone) {
    const ok = await confirm({
      title: t('projects.detail.schedule.deleteTitle'),
      description: t('projects.detail.schedule.deleteDesc', { title: m.title || '—' }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(m.id)
      toastDeleted()
    } catch (err) {
      toastError(err)
    }
  }

  if (!projectId) return null

  const clientId =
    typeof project.data?.clientId === 'string' ? project.data.clientId : undefined

  const filtersActive =
    !!search || !!statusFilter || !!responsibleFilter || showOnlyLate

  return (
    <div className="space-y-4">
      {(project.isError || list.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {project.isError
              ? t('projects.detail.loadError')
              : t('projects.detail.schedule.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('projects.detail.schedule.subtitle')}
        </p>
        <Button onClick={() => addMilestone(null)} disabled={create.isPending}>
          <Plus className="h-4 w-4" />
          <span>{t('projects.detail.schedule.new')}</span>
        </Button>
      </div>

      {/* Filtros */}
      {milestones.length > 0 && (
        <Card className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('projects.detail.schedule.filterSearch')}
                  className="pl-9"
                />
              </div>
              <Combobox
                options={STATUS_OPTIONS.map((s) => ({
                  value: s,
                  label: t(`projects.detail.schedule.status.${s}`),
                }))}
                value={statusFilter}
                onChange={setStatusFilter}
                noneLabel={t('projects.detail.schedule.allStatuses')}
                placeholder={t('projects.detail.schedule.filterStatus')}
              />
              <Combobox
                options={responsibleOptions}
                value={responsibleFilter}
                onChange={setResponsibleFilter}
                noneLabel={t('projects.detail.schedule.allResponsibles')}
                placeholder={t('projects.detail.schedule.filterResponsible')}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showOnlyLate}
                onChange={(e) => setShowOnlyLate(e.target.checked)}
              />
              {t('projects.detail.schedule.onlyLate')}
            </label>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setResponsibleFilter('')
                  setShowOnlyLate(false)
                }}
              >
                <X className="h-4 w-4" />
                {t('projects.detail.schedule.clearFilters')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {list.isLoading ? (
        <Card>
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('app.loading')}
          </div>
        </Card>
      ) : milestones.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('projects.detail.schedule.empty')}
          </div>
        </Card>
      ) : (
        <>
          {/* Gantt visual no topo. Renderiza só se houver pelo menos 1 marco
              com data planejada — caso contrário não há eixo X significativo. */}
          {milestones.some(
            (m) =>
              /^\d{4}-\d{2}-\d{2}/.test(m.plannedEndDate ?? '') ||
              /^\d{4}-\d{2}-\d{2}/.test(m.plannedStartDate ?? ''),
          ) && (
            <Card>
              <div className="p-3">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {t('projects.detail.schedule.ganttTitle')}
                </h3>
                <GanttChart milestones={milestones} />
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('projects.detail.schedule.th.title')}</TableHead>
                  <TableHead className="w-32">
                    {t('projects.detail.schedule.th.plannedStart')}
                  </TableHead>
                  <TableHead className="w-32">
                    {t('projects.detail.schedule.th.plannedEnd')}
                  </TableHead>
                  <TableHead className="w-28">
                    {t('projects.detail.schedule.th.actualEnd')}
                  </TableHead>
                  <TableHead className="w-28">
                    {t('projects.detail.schedule.th.progress')}
                  </TableHead>
                  <TableHead className="w-32">
                    {t('projects.detail.schedule.th.status')}
                  </TableHead>
                  <TableHead className="w-56">
                    {t('projects.detail.schedule.th.responsible')}
                  </TableHead>
                  <TableHead className="w-44">
                    {t('projects.detail.schedule.th.dependsOn')}
                  </TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {flat.map((m) => (
                  <ScheduleRow
                    key={m.id}
                    milestone={m}
                    clientId={clientId}
                    expanded={expanded.has(m.id)}
                    dependencyOptions={dependencyOptions.filter(
                      (d) => d.value !== m.id,
                    )}
                    locale={i18n.language}
                    onToggleExpand={() => toggleExpand(m.id)}
                    onPatch={(patch) => patchAndSave(m.id, patch)}
                    onAddSubtask={() => addMilestone(m.id)}
                    onDelete={() => removeMilestone(m)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}

function ScheduleRow({
  milestone,
  clientId,
  expanded,
  dependencyOptions,
  locale: _locale,
  onToggleExpand,
  onPatch,
  onAddSubtask,
  onDelete,
}: {
  milestone: EnrichedMilestone
  clientId?: string
  expanded: boolean
  dependencyOptions: { value: string; label: string }[]
  locale: string
  onToggleExpand: () => void
  onPatch: (patch: Partial<Milestone>) => void
  onAddSubtask: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const m = milestone
  const eff = effectiveStatus(m)

  // Estado local pra evitar fazer N requests por keystroke. Salva on blur.
  const [title, setTitle] = useState(m.title)
  const [progress, setProgress] = useState(m.progress ?? 0)
  useEffect(() => setTitle(m.title), [m.title])
  useEffect(() => setProgress(m.progress ?? 0), [m.progress])

  // Valida data fim >= início inline pra dar feedback visual imediato.
  const dateInvalid =
    !!m.plannedStartDate &&
    !!m.plannedEndDate &&
    String(m.plannedEndDate).slice(0, 10) <
      String(m.plannedStartDate).slice(0, 10)

  return (
    <TableRow>
      <TableCell className="w-8 align-top">
        {m.hasChildren ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </TableCell>
      <TableCell>
        <div style={{ marginLeft: m.depth * 20 }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== m.title) onPatch({ title })
            }}
            placeholder={t('projects.detail.schedule.titlePlaceholder')}
            className={cn('h-8', m.depth > 0 && 'text-xs')}
          />
          <button
            type="button"
            onClick={onAddSubtask}
            className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {t('projects.detail.schedule.addSubtask')}
          </button>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={m.plannedStartDate ?? ''}
          onChange={(e) =>
            onPatch({ plannedStartDate: e.target.value || null })
          }
          className={cn('h-8', dateInvalid && 'border-destructive')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={m.plannedEndDate ?? ''}
          onChange={(e) =>
            onPatch({ plannedEndDate: e.target.value || null })
          }
          className={cn('h-8', dateInvalid && 'border-destructive')}
        />
        {dateInvalid && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {t('projects.detail.schedule.dateInvalid')}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={m.actualEndDate ?? ''}
          onChange={(e) =>
            onPatch({ actualEndDate: e.target.value || null })
          }
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) =>
              setProgress(
                Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              )
            }
            onBlur={() => {
              if (progress !== (m.progress ?? 0)) onPatch({ progress })
            }}
            className="h-8 w-16"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell>
        <select
          value={m.status}
          onChange={(e) => {
            const status = e.target.value as MilestoneStatus
            // Quando user marca como done, força progress=100 pra coerência.
            if (status === 'done') {
              onPatch({ status, progress: 100 })
              setProgress(100)
            } else {
              onPatch({ status })
            }
          }}
          className={cn(
            'h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium',
            STATUS_TONE[eff],
          )}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`projects.detail.schedule.status.${s}`)}
            </option>
          ))}
        </select>
        {eff === 'late' && m.status !== 'done' && (
          <span className="mt-0.5 block text-[10px] font-semibold uppercase text-destructive">
            {t('projects.detail.schedule.lateLabel')}
          </span>
        )}
      </TableCell>
      <TableCell>
        <MultiUserSelect
          values={m.responsibleIds ?? []}
          onChange={(ids) => onPatch({ responsibleIds: ids })}
          scopeClientId={clientId}
        />
      </TableCell>
      <TableCell>
        <DependsOnEditor
          milestone={m}
          options={dependencyOptions}
          onChange={(ids) => onPatch({ dependsOn: ids })}
        />
      </TableCell>
      <TableCell className="text-right">
        <IconTooltip label={t('catalogs.detail.delete')}>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </IconTooltip>
      </TableCell>
    </TableRow>
  )
}

/**
 * Editor compacto de "depende de": mostra chips dos IDs selecionados +
 * Combobox pra adicionar mais. Click no chip remove. Salva via onChange
 * — o caller decide quando persistir.
 */
function DependsOnEditor({
  milestone,
  options,
  onChange,
}: {
  milestone: Milestone
  options: { value: string; label: string }[]
  onChange: (ids: string[]) => void
}) {
  const ids = milestone.dependsOn ?? []
  const labelOf = (id: string) =>
    options.find((o) => o.value === id)?.label ?? id
  const remaining = options.filter((o) => !ids.includes(o.value))
  return (
    <div className="space-y-1">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]"
              title={labelOf(id)}
            >
              <span className="max-w-[100px] truncate">{labelOf(id)}</span>
              <button
                type="button"
                onClick={() => onChange(ids.filter((x) => x !== id))}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Combobox
        options={remaining}
        value=""
        onChange={(v) => v && onChange([...ids, v])}
        placeholder="+ adicionar..."
        disabled={remaining.length === 0}
      />
    </div>
  )
}
