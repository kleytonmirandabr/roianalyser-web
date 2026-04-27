import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
  writeFinancialInputs,
  type ProjectFinancialInputs,
} from '@/features/projects/lib/financials'
import { formatCurrency } from '@/features/projects/lib/money'
import type { ProjectPayload } from '@/features/projects/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/cn'

function pct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

/**
 * Financeiro — parâmetros do modelo (comissão, impostos, prazo, meta de
 * margem) + KPIs derivados aplicando essas premissas sobre os dados das
 * Entradas Dinâmicas.
 */
export function ProjectFinanceiroView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')

  const [inputs, setInputs] = useState<ProjectFinancialInputs>({
    prazo: 36,
    comissaoPct: 0,
    impostosPct: 0,
    margemMeta: 0,
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!project.data) return
    setInputs(readFinancialInputs(project.data.payload as Record<string, unknown> | null))
    setDirty(false)
  }, [project.data])

  const cashFlow = useMemo(() => {
    if (!project.data) return []
    return buildCashFlow(project.data.payload as Record<string, unknown> | null, inputs)
  }, [project.data, inputs])
  const metrics = useMemo(() => computeMetrics(cashFlow), [cashFlow])
  const currency = project.data?.currency ?? 'BRL'

  function patch<K extends keyof ProjectFinancialInputs>(
    key: K,
    value: ProjectFinancialInputs[K],
  ) {
    setInputs((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!project.data) return
    const base = (project.data.payload ?? {}) as Record<string, unknown>
    const payload = writeFinancialInputs(base, inputs) as ProjectPayload
    try {
      await update.mutateAsync({ payload })
      toastSaved(t('projects.detail.financeiro.saved'))
      setDirty(false)
    } catch (err) {
      toastError(err)
    }
  }

  if (!params.id) return null

  const meta = inputs.margemMeta ?? 0
  const marginTone =
    meta > 0
      ? metrics.margin < meta
        ? 'bad'
        : metrics.margin < meta + 5
          ? 'warn'
          : 'good'
      : metrics.margin >= 0
        ? 'good'
        : 'bad'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('projects.detail.financeiro.paramsTitle')}</CardTitle>
          <CardDescription>
            {t('projects.detail.financeiro.paramsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="prazo">{t('projects.detail.financeiro.prazo')}</Label>
              <Input
                id="prazo"
                type="number"
                min={1}
                value={inputs.prazo}
                onChange={(e) =>
                  patch('prazo', Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finCom">{t('projects.detail.financeiro.comissao')}</Label>
              <Input
                id="finCom"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={inputs.comissaoPct}
                onChange={(e) =>
                  patch(
                    'comissaoPct',
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finImp">{t('projects.detail.financeiro.impostos')}</Label>
              <Input
                id="finImp"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={inputs.impostosPct}
                onChange={(e) =>
                  patch(
                    'impostosPct',
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finMeta">{t('projects.detail.financeiro.metaMargem')}</Label>
              <Input
                id="finMeta"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={inputs.margemMeta ?? 0}
                onChange={(e) =>
                  patch(
                    'margemMeta',
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            {dirty && (
              <span className="text-xs text-muted-foreground">
                {t('projects.detail.financeiro.unsaved')}
              </span>
            )}
            <Button onClick={handleSave} disabled={!dirty || update.isPending}>
              {update.isPending
                ? t('projects.detail.financeiro.saving')
                : t('projects.detail.financeiro.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('projects.detail.financeiro.kpisTitle')}</CardTitle>
          <CardDescription>
            {t('projects.detail.financeiro.kpisDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <KpiPill
              label={t('projects.detail.financeiro.kpi.netRevenue')}
              value={formatCurrency(metrics.totalRevenue, currency)}
              hint={t('projects.detail.financeiro.kpi.netRevenueHint', {
                gross: formatCurrency(
                  metrics.totalRecurringRevenue + metrics.totalOneTimeRevenue,
                  currency,
                ),
                fin: formatCurrency(metrics.totalFinancial, currency),
              })}
            />
            <KpiPill
              label={t('projects.detail.financeiro.kpi.totalCost')}
              value={formatCurrency(metrics.totalCost, currency)}
              hint={t('projects.detail.financeiro.kpi.totalCostHint', {
                inv: formatCurrency(metrics.totalInvestment, currency),
                rec: formatCurrency(metrics.totalRecurringCost, currency),
              })}
            />
            <KpiPill
              label={t('projects.detail.financeiro.kpi.result')}
              value={formatCurrency(metrics.totalResult, currency)}
              tone={metrics.totalResult >= 0 ? 'good' : 'bad'}
              hint={t('projects.detail.financeiro.kpi.resultHint', {
                margin: pct(metrics.margin),
              })}
            />
            <KpiPill
              label={t('projects.detail.financeiro.kpi.marginVsMeta')}
              value={pct(metrics.margin)}
              tone={
                marginTone === 'good'
                  ? 'good'
                  : marginTone === 'warn'
                    ? 'warn'
                    : 'bad'
              }
              hint={
                meta > 0
                  ? t('projects.detail.financeiro.kpi.marginHintMeta', {
                      meta: pct(meta),
                      ok:
                        metrics.margin >= meta
                          ? t('projects.detail.financeiro.kpi.marginOk')
                          : t('projects.detail.financeiro.kpi.marginBelow'),
                    })
                  : t('projects.detail.financeiro.kpi.marginHintNoMeta')
              }
            />
            <KpiPill
              label={t('projects.detail.financeiro.kpi.payback')}
              value={
                metrics.paybackMonth != null
                  ? t('projects.detail.financeiro.kpi.paybackValue', {
                      month: metrics.paybackMonth,
                      prazo: inputs.prazo,
                    })
                  : t('projects.detail.financeiro.kpi.paybackNone')
              }
              tone={metrics.paybackMonth != null ? 'good' : 'bad'}
            />
            <KpiPill
              label={t('projects.detail.financeiro.kpi.peakTrough')}
              value={`${formatCurrency(metrics.peakAccum, currency)} / ${formatCurrency(metrics.troughAccum, currency)}`}
              hint={t('projects.detail.financeiro.kpi.peakTroughHint')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

type KpiPillProps = {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'warn' | 'neutral'
}

function KpiPill({ label, value, hint, tone = 'neutral' }: KpiPillProps) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && 'text-amber-600',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
