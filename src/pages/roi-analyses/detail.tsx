/**
 * Detalhe de ROI Analysis — entries + métricas + transições (Sprint 5 Batch B).
 * Aprovação destrava criação de Contrato pra Oportunidade pai.
 */

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  useAddRoiEntry, useDeleteRoiEntry,
} from '@/features/roi-analyses/hooks/use-roi-entries'
import { useRoiAnalysis } from '@/features/roi-analyses/hooks/use-roi-analysis'
import { useUpdateRoiAnalysis } from '@/features/roi-analyses/hooks/use-update-roi'
import {
  FLOW_TYPE_LABELS, ROI_STATUSES, ROI_STATUS_LABELS,
  type FlowType, type RoiStatus,
} from '@/features/roi-analyses/types'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'

export function RoiAnalysisDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useRoiAnalysis(id)
  const update = useUpdateRoiAnalysis(id)
  const addEntry = useAddRoiEntry(id)
  const deleteEntry = useDeleteRoiEntry(id)

  const [newPeriod, setNewPeriod] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newFlowType, setNewFlowType] = useState<FlowType>('inflow')

  const roi = data?.item
  const entries = data?.entries || []
  const isFrozen = roi?.status === 'approved' || roi?.status === 'archived'

  const statusOptions = ROI_STATUSES.map(s => ({ value: s, label: ROI_STATUS_LABELS[s] }))
  const flowOptions: { value: FlowType; label: string }[] = [
    { value: 'inflow', label: FLOW_TYPE_LABELS.inflow },
    { value: 'outflow', label: FLOW_TYPE_LABELS.outflow },
  ]

  async function handleStatusChange(newStatus: RoiStatus) {
    if (!roi) return
    try {
      await update.mutateAsync({ status: newStatus })
      const msg = newStatus === 'approved'
        ? 'ROI aprovado — destrava criação de contrato'
        : `Status: ${ROI_STATUS_LABELS[newStatus]}`
      toastSaved(msg)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleAddEntry() {
    if (!roi) return
    if (!newPeriod) return toastError('Período é obrigatório')
    if (!newCategory.trim()) return toastError('Categoria é obrigatória')
    const amountNum = Number(newAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return toastError('Valor precisa ser positivo')
    try {
      await addEntry.mutateAsync({
        period: newPeriod.length === 7 ? `${newPeriod}-01` : newPeriod,
        categoryKey: newCategory.trim(),
        description: newDescription.trim() || null,
        amount: amountNum,
        flowType: newFlowType,
      })
      setNewPeriod(''); setNewCategory(''); setNewDescription(''); setNewAmount('')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      await deleteEntry.mutateAsync(entryId)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  if (isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>
  if (error) return <div className="p-6"><Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert></div>
  if (!roi) return <div className="p-6"><Alert><AlertDescription>ROI Analysis não encontrado.</AlertDescription></Alert></div>

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/opportunities/${roi.opportunityId}`}><ArrowLeft className="h-4 w-4" />Oportunidade</Link>
        </Button>
      </header>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground mr-2">v{roi.version}</span>
            {roi.name}
            {roi.isBaseline && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">baseline</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado {new Date(roi.createdAt).toLocaleDateString('pt-BR')}
            {roi.approvedAt && ` · Aprovado ${new Date(roi.approvedAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="w-44">
            <Combobox value={roi.status} onChange={v => handleStatusChange(v as RoiStatus)} options={statusOptions} />
          </div>
        </div>
      </div>

      {isFrozen && (
        <Alert>
          <AlertDescription>
            ROI {roi.status === 'approved' ? 'aprovado' : 'arquivado'} — entries imutáveis.
            {roi.status === 'approved' && ' Contrato pode ser criado a partir desta análise.'}
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase">Receita total</div>
            <div className="text-lg font-semibold tabular-nums text-emerald-700">{formatCurrency(roi.totalRevenue, roi.currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Custo total</div>
            <div className="text-lg font-semibold tabular-nums text-rose-700">{formatCurrency(roi.totalCost, roi.currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Valor líquido</div>
            <div className={`text-lg font-semibold tabular-nums ${(roi.netValue || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(roi.netValue, roi.currency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">NPV</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(roi.npv, roi.currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">IRR</div>
            <div className="text-lg font-semibold tabular-nums">{roi.irr != null ? formatPercent(roi.irr * 100, 2) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Payback</div>
            <div className="text-lg font-semibold tabular-nums">
              {roi.paybackMonths != null ? `${roi.paybackMonths} meses` : '—'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Entradas ({entries.length})</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Categoria livre por enquanto (ex: receita_recorrente, hosting_aws). Métricas recalculadas a cada mudança.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Período</th>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2 text-xs">{(e.period || '').slice(0, 7)}</td>
                <td className="px-3 py-2">{e.categoryKey}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.description || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(e.amount, roi.currency)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${e.flowType === 'inflow' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {FLOW_TYPE_LABELS[e.flowType]}
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
                  <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="receita / hosting / ..." className="w-32" />
                </td>
                <td className="px-3 py-2">
                  <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Descrição" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Input type="number" step="0.01" min="0" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0,00" className="w-32 text-right" />
                </td>
                <td className="px-3 py-2">
                  <Combobox value={newFlowType} onChange={v => setNewFlowType(v as FlowType)} options={flowOptions} />
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" onClick={handleAddEntry} disabled={addEntry.isPending}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            )}

            {entries.length === 0 && isFrozen && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sem entries.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <CustomFieldsCard scope="roi" entityType="roi_analysis" entityId={id} />
    </div>
  )
}
