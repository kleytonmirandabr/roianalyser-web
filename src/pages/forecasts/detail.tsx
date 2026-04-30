/**
 * Detalhe de Forecast — entries CRUD inline + transições de status (Sprint 4 Batch B).
 *
 * Fluxo: rascunho → submetido → aprovado/rejeitado.
 * Forecast aprovado fica imutável (não aceita novas entries via UI).
 */

import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  useAddForecastEntry, useDeleteForecastEntry, useUpdateForecastEntry,
} from '@/features/forecasts/hooks/use-forecast-entries'
import { useForecast } from '@/features/forecasts/hooks/use-forecast'
import { useUpdateForecast } from '@/features/forecasts/hooks/use-update-forecast'
import {
  FORECAST_STATUSES, FORECAST_STATUS_LABELS, type ForecastStatus,
} from '@/features/forecasts/types'
import { useProject2 } from '@/features/projects2/hooks/use-project'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

export function ForecastDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useForecast(id)
  const update = useUpdateForecast(id)
  const addEntry = useAddForecastEntry(id)
  const updateEntry = useUpdateForecastEntry(id)
  const deleteEntry = useDeleteForecastEntry(id)

  const [newPeriod, setNewPeriod] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newExpected, setNewExpected] = useState('')

  const fc = data?.item
  const entries = data?.entries || []
  const isFrozen = fc?.status === 'approved' || fc?.status === 'archived'

  // Forecast não tem currency próprio — herda do projeto pai
  const { data: project } = useProject2(fc?.projectId)
  const currency = project?.currency || 'BRL'

  const statusOptions = FORECAST_STATUSES.map(s => ({ value: s, label: FORECAST_STATUS_LABELS[s] }))

  async function handleStatusChange(newStatus: ForecastStatus) {
    if (!fc) return
    try {
      await update.mutateAsync({ status: newStatus })
      toastSaved(`Status: ${FORECAST_STATUS_LABELS[newStatus]}`)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleAddEntry() {
    if (!fc) return
    if (!newPeriod) return toastError('Período é obrigatório')
    if (!newCategory.trim()) return toastError('Categoria é obrigatória')
    const expectedNum = Number(newExpected)
    if (!Number.isFinite(expectedNum)) return toastError('Valor esperado precisa ser numérico')
    try {
      await addEntry.mutateAsync({
        period: newPeriod.length === 7 ? `${newPeriod}-01` : newPeriod,  // YYYY-MM → YYYY-MM-01
        categoryKey: newCategory.trim(),
        description: newDescription.trim() || null,
        expected: expectedNum,
      })
      setNewPeriod(''); setNewCategory(''); setNewDescription(''); setNewExpected('')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleSetActual(entryId: string, value: string) {
    const v = value === '' ? null : Number(value)
    if (v != null && !Number.isFinite(v)) return
    try {
      await updateEntry.mutateAsync({
        entryId,
        patch: { actual: v, paidStatus: v != null ? 'paid' : 'pending' },
      })
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      await deleteEntry.mutateAsync(entryId)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  if (isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>
  if (error) return <div className="p-6"><Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert></div>
  if (!fc) return <div className="p-6"><Alert><AlertDescription>Forecast não encontrado.</AlertDescription></Alert></div>

  const totalExpected = entries.reduce((s, e) => s + e.expected, 0)
  const totalActual = entries.reduce((s, e) => s + (e.actual || 0), 0)

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/projects/${fc.projectId}`}><ArrowLeft className="h-4 w-4" />{t('common.entity.project')}</Link>
        </Button>
      </header>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground mr-2">v{fc.version}</span>
            {fc.name}
            {fc.isBaseline && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">baseline</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado {new Date(fc.createdAt).toLocaleDateString('pt-BR')}
            {fc.approvedAt && ` · Aprovado ${new Date(fc.approvedAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="w-44">
            <Combobox
              value={fc.status}
              onChange={(v) => handleStatusChange(v as ForecastStatus)}
              options={statusOptions}
            />
          </div>
        </div>
      </div>

      {fc.fromRoiAnalysisId && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase">{t('common.fields.origin')}</span>
              <p className="text-sm">Herdado do ROI Analysis #{fc.fromRoiAnalysisId}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      )}

      {isFrozen && (
        <Alert>
          <AlertDescription>
            Forecast {fc.status === 'approved' ? 'aprovado' : 'arquivado'} — entries imutáveis.
            Pra ajustar valores, crie nova revisão a partir desta.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase">{t('common.fields.expected')}</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalExpected, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">{t('common.fields.actual')}</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalActual, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">{t('common.fields.variation')}</div>
            <div className={`text-lg font-semibold tabular-nums ${totalActual > totalExpected ? 'text-emerald-700' : totalActual < totalExpected ? 'text-rose-700' : ''}`}>
              {totalExpected ? formatPercent(((totalActual - totalExpected) / totalExpected) * 100) : '—'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Entradas ({entries.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">{t('common.fields.period')}</th>
              <th className="px-3 py-2 font-medium">{t('common.fields.category')}</th>
              <th className="px-3 py-2 font-medium">{t('common.fields.description')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('common.fields.expected')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('common.fields.actual')}</th>
              <th className="px-3 py-2 font-medium">{t('common.fields.status')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2 text-xs">{(e.period || '').slice(0, 7)}</td>
                <td className="px-3 py-2">{e.categoryKey}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.description || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(e.expected, currency)}</td>
                <td className="px-3 py-2 text-right">
                  {isFrozen ? (
                    <span className="tabular-nums">{formatCurrency(e.actual, currency)}</span>
                  ) : (
                    <Input
                      type="number" step="0.01"
                      defaultValue={e.actual ?? ''}
                      onBlur={(ev) => {
                        const newVal = ev.target.value
                        if (String(e.actual ?? '') !== newVal) handleSetActual(e.id, newVal)
                      }}
                      className="w-32 text-right"
                      placeholder="—"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs ${e.paidStatus === 'paid' ? 'text-emerald-700' : e.paidStatus === 'partial' ? 'text-amber-700' : 'text-muted-foreground'}`}>
                    {e.paidStatus}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {!isFrozen && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(e.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}

            {!isFrozen && (
              <tr className="border-t bg-muted/20">
                <td className="px-3 py-2">
                  <Input type="month" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="w-32" />
                </td>
                <td className="px-3 py-2">
                  <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="receita / custo / ..." className="w-32" />
                </td>
                <td className="px-3 py-2">
                  <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Descrição" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Input type="number" step="0.01" value={newExpected} onChange={e => setNewExpected(e.target.value)} placeholder="0,00" className="w-32 text-right" />
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">
                  <Button size="sm" onClick={handleAddEntry} disabled={addEntry.isPending}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            )}

            {entries.length === 0 && isFrozen && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem entries.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
