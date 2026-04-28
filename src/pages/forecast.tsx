import { Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  useAppState,
  usePatchAppState,
} from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import {
  buildRollingForecast,
  DEFAULT_SCENARIOS,
  type ForecastScenario,
  type ScenarioAdjustment,
} from '@/features/forecast/lib/rolling'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { formatCurrency } from '@/features/projects/lib/money'
import type { ProjectStatus } from '@/features/projects/lib/status-categories'
import { cn } from '@/shared/lib/cn'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

export function ForecastPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projects = useProjects()
  const statuses = useCatalog('projectStatuses')
  const appState = useAppState()
  const patch = usePatchAppState()

  const [activeScenarioId, setActiveScenarioId] = useState<string>('scenario_base')
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false)

  // Scenarios são persistidos em appState.systemRules.forecastScenarios.
  const scenarios = useMemo<ForecastScenario[]>(() => {
    const stored = (appState.data?.systemRules as { forecastScenarios?: ForecastScenario[] })
      ?.forecastScenarios
    if (Array.isArray(stored) && stored.length > 0) return stored
    return DEFAULT_SCENARIOS
  }, [appState.data])

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0]

  // Tenant currency: pega a moeda mais comum dos projetos
  const tenantCurrency = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of projects.data ?? []) {
      counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1)
    }
    let max = 0
    let cur = 'BRL'
    for (const [c, n] of counts) {
      if (n > max) {
        max = n
        cur = c
      }
    }
    return cur
  }, [projects.data])

  // Horizonte do tenant ATIVO (não do clientId base do user). Se o admin
  // tem múltiplos tenants e troca pelo switcher, o horizon precisa
  // refletir o tenant onde ele está olhando agora.
  const activeTenantId = user?.activeClientId ?? user?.clientId
  const horizon = useMemo(() => {
    const client = (appState.data?.clients ?? []).find(
      (c) => c.id === activeTenantId,
    )
    return client?.forecastHorizonMonths ?? 18
  }, [appState.data, activeTenantId])

  const result = useMemo(
    () =>
      buildRollingForecast(
        projects.data ?? [],
        activeScenario,
        horizon,
        (statuses.data ?? []) as unknown as ProjectStatus[],
      ),
    [projects.data, activeScenario, horizon, statuses.data],
  )

  const maxExpected = useMemo(
    () => Math.max(1, ...result.buckets.map((b) => b.expected), ...result.buckets.map((b) => b.actual)),
    [result.buckets],
  )

  async function persistScenarios(next: ForecastScenario[]) {
    try {
      await patch.mutateAsync({
        systemRules: { ...(appState.data?.systemRules ?? {}), forecastScenarios: next },
      })
      toastSaved(t('forecast.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function addAdjustment(adj: ScenarioAdjustment) {
    const next = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, adjustments: [...s.adjustments, adj] }
        : s,
    )
    setShowAdjustmentForm(false)
    await persistScenarios(next)
  }

  async function removeAdjustment(adjId: string) {
    const ok = await confirm({
      title: t('forecast.removeAdjustmentTitle'),
      description: t('forecast.removeAdjustmentDesc'),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    const next = scenarios.map((s) =>
      s.id === activeScenarioId
        ? {
            ...s,
            adjustments: s.adjustments.filter((a) => a.id !== adjId),
          }
        : s,
    )
    await persistScenarios(next)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('forecast.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('forecast.subtitle', { months: horizon })}
        </p>
      </div>

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      {/* Seletor de cenário */}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveScenarioId(s.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              activeScenarioId === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent',
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color ?? '#888' }}
            />
            {s.name}
            {s.adjustments.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground">
                {s.adjustments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KPIs do cenário */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('forecast.kpi.expected')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(result.totalExpected, tenantCurrency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('forecast.kpi.expectedHint', { months: horizon })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('forecast.kpi.actual')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(result.totalActual, tenantCurrency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('forecast.kpi.variance')}
            </div>
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums',
                result.totalActual >= result.totalExpected ? 'text-emerald-600' : 'text-destructive',
              )}
            >
              {result.totalActual >= result.totalExpected ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatCurrency(
                result.totalActual - result.totalExpected,
                tenantCurrency,
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('forecast.kpi.activeProjects')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {result.rows.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Curva visual: barras por mês */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.chartTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('forecast.chartHint')}
          </p>
        </CardHeader>
        <CardContent>
          {result.buckets.length === 0 || maxExpected === 0 ? (
            <p className="text-sm text-muted-foreground">{t('forecast.empty')}</p>
          ) : (
            <div className="flex items-end gap-1 overflow-x-auto pb-2">
              {result.buckets.map((b) => {
                const expectedPct = (b.expected / maxExpected) * 100
                const actualPct = (b.actual / maxExpected) * 100
                return (
                  <div
                    key={b.key}
                    className="flex shrink-0 flex-col items-center gap-1"
                    style={{ width: 56 }}
                    title={`${b.label}: previsto ${formatCurrency(b.expected, tenantCurrency)} · realizado ${formatCurrency(b.actual, tenantCurrency)}`}
                  >
                    <div className="flex h-40 w-full items-end gap-0.5">
                      <div
                        className="w-1/2 rounded-t-sm"
                        style={{
                          height: `${Math.max(expectedPct, b.expected > 0 ? 2 : 0)}%`,
                          backgroundColor: activeScenario.color ?? '#4f46e5',
                          opacity: 0.7,
                        }}
                      />
                      <div
                        className="w-1/2 rounded-t-sm bg-foreground/80"
                        style={{
                          height: `${Math.max(actualPct, b.actual > 0 ? 2 : 0)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {b.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm opacity-70"
                style={{ backgroundColor: activeScenario.color ?? '#4f46e5' }}
              />
              {t('forecast.legendExpected')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-foreground/80" />
              {t('forecast.legendActual')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Ajustes do cenário */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {t('forecast.adjustmentsTitle', { name: activeScenario.name })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('forecast.adjustmentsHint')}
            </p>
          </div>
          <Button onClick={() => setShowAdjustmentForm(true)} size="sm">
            <Plus className="h-4 w-4" />
            <span>{t('forecast.addAdjustment')}</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeScenario.adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('forecast.adjustmentsEmpty')}
            </p>
          ) : (
            activeScenario.adjustments.map((adj) => {
              const project = (projects.data ?? []).find((p) => p.id === adj.projectId)
              return (
                <div
                  key={adj.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {project?.name ?? adj.projectId}{' '}
                      {adj.month && (
                        <span className="text-muted-foreground">
                          · {adj.month}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {typeof adj.adjustmentValue === 'number'
                        ? `→ ${formatCurrency(adj.adjustmentValue, tenantCurrency)}`
                        : `${(adj.adjustmentPct ?? 0) * 100 >= 0 ? '+' : ''}${((adj.adjustmentPct ?? 0) * 100).toFixed(1)}%`}
                      {adj.reason && <> · {adj.reason}</>}
                    </div>
                  </div>
                  <IconTooltip label={t('catalogs.detail.delete')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAdjustment(adj.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {showAdjustmentForm && (
        <AdjustmentForm
          projects={projects.data ?? []}
          months={result.buckets.map((b) => b.key)}
          onCancel={() => setShowAdjustmentForm(false)}
          onSave={addAdjustment}
        />
      )}

      {/* Detalhamento por projeto */}
      {result.rows.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{t('forecast.detailsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">{t('projects.th.name')}</TableHead>
                    {result.buckets.map((b) => (
                      <TableHead
                        key={b.key}
                        className="text-right text-xs tabular-nums"
                      >
                        {b.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t('forecast.totalCol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.project.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <Link
                          to={`/projects/${row.project.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.project.name}
                        </Link>
                      </TableCell>
                      {result.buckets.map((b) => {
                        const v = row.byMonth.get(b.key) ?? 0
                        return (
                          <TableCell
                            key={b.key}
                            className={cn(
                              'text-right text-xs tabular-nums',
                              v === 0 && 'text-muted-foreground/40',
                            )}
                          >
                            {v > 0
                              ? formatCurrency(v, row.project.currency).replace('R$ ', '')
                              : '—'}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(row.totalExpected, row.project.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AdjustmentForm({
  projects,
  months,
  onCancel,
  onSave,
}: {
  projects: { id: string; name: string }[]
  months: string[]
  onCancel: () => void
  onSave: (adj: ScenarioAdjustment) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [projectId, setProjectId] = useState('')
  const [month, setMonth] = useState<string>('') // '' = todos os meses
  const [pct, setPct] = useState<string>('-100') // -100% por default (zerar)
  const [reason, setReason] = useState<string>('')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('forecast.formTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!projectId) return
            onSave({
              id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              projectId,
              month: month || null,
              adjustmentPct: Number(pct) / 100,
              reason,
              addedBy: user?.name ?? user?.email ?? user?.id,
              addedAt: new Date().toISOString(),
            })
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label>{t('forecast.field.project')}*</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">— —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('forecast.field.month')}</Label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('forecast.allMonths')}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('forecast.field.pct')}</Label>
            <Input
              type="number"
              step="1"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="-100 = zerar, -50 = metade, 20 = +20%"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('forecast.field.reason')}*</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder={t('forecast.field.reasonPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!projectId || !reason}>
              {t('common.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
