/**
 * Detalhe de Contrato — DOSSIÊ (Sprint B+C).
 *
 * Estrutura:
 *   1) Hero: nome + número + status com timeline horizontal + KPIs
 *   2) Origem: card que mostra ROI aprovado (link clicável) + oportunidade
 *   3) Documentos: AttachmentsCard (drag-drop + lista + preview)
 *   4) Projetos derivados (preserva o que existia)
 *   5) Edição de dados — agora num accordion no fim
 */

import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useContract } from '@/features/contracts2/hooks/use-contract'
import { useDeleteContract } from '@/features/contracts2/hooks/use-delete-contract'
import { useUpdateContract } from '@/features/contracts2/hooks/use-update-contract'
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  RENEWAL_TYPE_LABELS,
  type ContractStatus,
  type RenewalType,
} from '@/features/contracts2/types'
import { useProjects2 } from '@/features/projects2/hooks/use-projects'
import { PROJECT_STATUS_LABELS } from '@/features/projects2/types'
import { useRoiAnalysis } from '@/features/roi-analyses/hooks/use-roi-analysis'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'
import { formatCurrency } from '@/shared/lib/format'
import { AttachmentsCard } from '@/features/contracts2/components/AttachmentsCard'

// Ordem visual da timeline. terminated/renewed são ramos terminais — quando
// presentes, viram o estado final destacado em cor distinta.
const TIMELINE_STATUSES: ContractStatus[] = ['drafting', 'pending_signature', 'active', 'ending_soon', 'ended']

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const d1 = new Date(a).getTime()
  const d2 = new Date(b).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null
  return Math.round((d2 - d1) / (24 * 3600 * 1000))
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function StatusTimeline({ current }: { current: ContractStatus }) {
  // Casos especiais (terminated/renewed) — não fazem parte da linha "feliz"
  const isOffPath = current === 'terminated' || current === 'renewed'
  const idx = TIMELINE_STATUSES.indexOf(current)
  return (
    <div className="space-y-2">
      {isOffPath && (
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          current === 'terminated' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
        }`}>
          {CONTRACT_STATUS_LABELS[current]}
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TIMELINE_STATUSES.map((s, i) => {
          const isPast = !isOffPath && i < idx
          const isCurrent = !isOffPath && i === idx
          const tone = isPast ? 'bg-emerald-500 text-white'
            : isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
            : 'bg-muted text-muted-foreground'
          return (
            <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${tone}`}>
                <span className="text-[10px] font-mono opacity-70">{i + 1}</span>
                <span>{CONTRACT_STATUS_LABELS[s]}</span>
              </div>
              {i < TIMELINE_STATUSES.length - 1 && (
                <div className={`h-0.5 w-4 ${isPast ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KpiTile({ label, value, hint, tone = 'neutral' }: {
  label: string; value: string; hint?: string; tone?: 'neutral' | 'pos' | 'neg' | 'warn'
}) {
  const toneCls = tone === 'pos' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'neg' ? 'text-rose-700 dark:text-rose-400'
    : tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
    : 'text-foreground'
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  )
}

export function ContractDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ctr, isLoading, error } = useContract(id)
  const { data: relatedProjects = [] } = useProjects2(id ? { contractId: id } : {})
  const { data: approvedRoiResp } = useRoiAnalysis(ctr?.approvedRoiId || undefined)
  const approvedRoi = approvedRoiResp?.item
  const approvedRoiMetrics = approvedRoiResp?.metrics
  // Quando há ROI vinculado, moeda+valor vêm de lá (read-only). Valor de
  // referência: receita total da análise aprovada.
  const roiTotalRevenue = approvedRoiMetrics?.totalRevenue
  const roiCurrency = approvedRoi?.currency
  const isLockedFromRoi = !!ctr?.approvedRoiId && !!approvedRoi
  const update = useUpdateContract(id)
  const remove = useDeleteContract()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ContractStatus>('drafting')
  const [totalValue, setTotalValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('manual')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [contractTypeKey, setContractTypeKey] = useState('')
  const [dirty, setDirty] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    if (!ctr) return
    setName(ctr.name)
    setStatus(ctr.status)
    setTotalValue(String(ctr.totalValue || ''))
    setCurrency(ctr.currency || 'BRL')
    setStartDate(ctr.startDate || '')
    setEndDate(ctr.endDate || '')
    setSignedDate(ctr.signedDate || '')
    setRenewalType(ctr.renewalType)
    setNoticePeriodDays(String(ctr.noticePeriodDays || 30))
    setPaymentTerms(ctr.paymentTerms || '')
    setContractTypeKey(ctr.contractTypeKey || '')
    setDirty(false)
  }, [ctr])

  // KPIs computados
  const kpis = useMemo(() => {
    if (!ctr) return null
    const today = new Date().toISOString().slice(0, 10)
    const totalDays = daysBetween(ctr.startDate, ctr.endDate)
    const elapsed = daysBetween(ctr.startDate, today)
    const remaining = daysBetween(today, ctr.endDate)
    const elapsedPct = totalDays && totalDays > 0
      ? Math.max(0, Math.min(100, ((elapsed || 0) / totalDays) * 100))
      : null
    return {
      remainingDays: remaining,
      elapsedPct,
      totalDays,
    }
  }, [ctr])

  if (isLoading || !id) return <Skeleton className="h-64" />
  if (error) return <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
  if (!ctr) return <Alert variant="destructive"><AlertDescription>Contrato não encontrado.</AlertDescription></Alert>

  const statusOptions = CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS[s] }))
  const renewalOptions = (Object.entries(RENEWAL_TYPE_LABELS) as Array<[RenewalType, string]>).map(
    ([value, label]) => ({ value, label }),
  )

  async function handleSave() {
    if (!ctr) return
    try {
      await update.mutateAsync({
        name,
        status,
        totalValue: Number(totalValue) || 0,
        currency,
        startDate: startDate || null,
        endDate: endDate || null,
        signedDate: signedDate || null,
        renewalType,
        noticePeriodDays: Number(noticePeriodDays) || 30,
        paymentTerms: paymentTerms || null,
        contractTypeKey: contractTypeKey || null,
      })
      toastSaved(t('common.actions.savedSuccessfully'))
      setDirty(false)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir contrato',
      description: 'Esta ação é irreversível. Confirma?',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok || !ctr) return
    try {
      await remove.mutateAsync(ctr.id)
      toastDeleted('Contrato excluído')
      navigate('/contracts')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/contracts">
            <ArrowLeft className="h-4 w-4" />Contratos
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4 text-rose-600" /> Excluir
        </Button>
      </header>

      {/* Alerta de divergência: contrato vinculado mas valores não batem com ROI */}
      {isLockedFromRoi && roiTotalRevenue != null && roiCurrency && (
        ctr.totalValue !== roiTotalRevenue || (ctr.currency || '').toUpperCase() !== (roiCurrency || '').toUpperCase()
      ) && (
        <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-amber-900 dark:text-amber-200">Valores divergem do ROI aprovado</div>
            <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              Contrato: <strong>{formatCurrency(ctr.totalValue, ctr.currency)}</strong> ({ctr.currency}) |
              ROI v{approvedRoi?.version}: <strong>{formatCurrency(roiTotalRevenue, roiCurrency)}</strong> ({roiCurrency})
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await update.mutateAsync({ totalValue: roiTotalRevenue, currency: roiCurrency })
                toastSaved('Sincronizado com o ROI')
              } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
            }}
            disabled={update.isPending}
          >Sincronizar com o ROI</Button>
        </div>
      )}

      {/* HERO — nome + número + timeline + KPIs */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground font-mono mb-1">{ctr.contractNumber}</div>
            <h1 className="text-2xl font-bold tracking-tight">{ctr.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {fmtShortDate(ctr.startDate)} {ctr.endDate ? `→ ${fmtShortDate(ctr.endDate)}` : ''}
              {ctr.signedDate && <span> · Assinado {fmtShortDate(ctr.signedDate)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Mudar status:</Label>
            <div className="w-48">
              <Combobox
                value={status}
                onChange={(v) => {
                  const ns = v as ContractStatus
                  setStatus(ns)
                  // Atualização imediata só do status (UX direto)
                  if (ctr && ns !== ctr.status) {
                    update.mutateAsync({ status: ns }).then(() => toastSaved('Status atualizado')).catch((err) => toastError(`Erro: ${(err as Error).message}`))
                  }
                }}
                options={statusOptions}
              />
            </div>
          </div>
        </div>

        <StatusTimeline current={ctr.status} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 pt-2 border-t">
          <KpiTile
            label="Valor contratado"
            value={formatCurrency(ctr.totalValue, ctr.currency)}
            tone="neutral"
          />
          <KpiTile
            label={kpis?.remainingDays != null && kpis.remainingDays >= 0 ? 'Encerra em' : kpis?.remainingDays != null ? 'Encerrado há' : 'Vigência'}
            value={
              kpis?.remainingDays == null ? '—'
              : kpis.remainingDays >= 0 ? `${kpis.remainingDays} dias`
              : `${Math.abs(kpis.remainingDays)} dias`
            }
            hint={kpis?.totalDays ? `de ${kpis.totalDays} dias totais` : undefined}
            tone={
              kpis?.remainingDays == null ? 'neutral'
              : kpis.remainingDays < 0 ? 'neg'
              : kpis.remainingDays <= ctr.noticePeriodDays ? 'warn'
              : 'pos'
            }
          />
          <KpiTile
            label="% do prazo decorrido"
            value={kpis?.elapsedPct != null ? `${kpis.elapsedPct.toFixed(0)}%` : '—'}
            hint={ctr.renewalType === 'auto' ? 'Renovação automática' : ctr.renewalType === 'manual' ? 'Renovação manual' : 'Sem renovação'}
            tone="neutral"
          />
          <KpiTile
            label="Aviso prévio"
            value={`${ctr.noticePeriodDays} dias`}
            hint="Antes do encerramento"
            tone="neutral"
          />
        </div>
      </Card>

      {/* ORIGEM — Oportunidade + ROI aprovado */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Origem</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Oportunidade */}
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Oportunidade</div>
            {ctr.opportunityId ? (
              <Link to={`/opportunities/${ctr.opportunityId}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline">
                Ver oportunidade <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground italic">Contrato avulso (sem oportunidade vinculada)</div>
            )}
          </div>
          {/* ROI aprovado */}
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">ROI Aprovado</div>
            {ctr.approvedRoiId && approvedRoi ? (
              <div className="mt-1 space-y-1">
                <Link to={`/roi-analyses/${approvedRoi.id}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  <FileSpreadsheet className="h-3 w-3" /> {approvedRoi.name} (v{approvedRoi.version}) <ExternalLink className="h-3 w-3" />
                </Link>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Duração: {approvedRoi.durationMonths || 12} meses</span>
                  <span>Moeda: {approvedRoi.currency}</span>
                  <span>Status: {approvedRoi.status}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground italic">Nenhum ROI vinculado</div>
            )}
          </div>
        </div>
      </Card>

      {/* DOCUMENTOS */}
      <AttachmentsCard contractId={id} />

      {/* PROJETOS DERIVADOS */}
      {(ctr.status === 'active' || ctr.status === 'ending_soon' ||
        ctr.status === 'ended' || relatedProjects.length > 0) && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Projetos derivados ({relatedProjects.length})</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Inicie projetos a partir deste contrato.</p>
            </div>
            <Button size="sm" asChild>
              <Link to={`/projects/new?contractId=${ctr.id}`}>
                <Plus className="h-4 w-4" />Iniciar projeto
              </Link>
            </Button>
          </div>
          {relatedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum projeto iniciado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {relatedProjects.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/30">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{p.projectCode}</span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">{p.progressPct.toFixed(0)}%</span>
                      <span className="text-muted-foreground">{PROJECT_STATUS_LABELS[p.status]}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* CAMPOS PERSONALIZADOS */}
      <CustomFieldsCard scope="contract" entityType="contract" entityId={id} />

      {/* EDITOR DE DADOS — accordion no fim */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
          onClick={() => setEditorOpen((v) => !v)}
        >
          <div>
            <h2 className="text-lg font-semibold">Editar dados do contrato</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Nome, valor, datas, renovação, condições de pagamento.</p>
          </div>
          {editorOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {editorOpen && (
          <div className="p-6 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label htmlFor="ctype">Tipo</Label>
                <Input id="ctype" value={contractTypeKey} onChange={(e) => { setContractTypeKey(e.target.value); setDirty(true) }} />
              </div>
            </div>
            {/* Mensagem informativa quando vinculado ao ROI */}
            {isLockedFromRoi && (
              <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
                Valor total e moeda vêm do <strong>ROI aprovado v{approvedRoi?.version}</strong>. Pra ajustar, edite a análise antes de aprovar uma nova versão.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value" className="flex items-center gap-2">
                  Valor total
                  {isLockedFromRoi && (
                    <span className="text-[10px] uppercase font-bold tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">Do ROI</span>
                  )}
                </Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={totalValue}
                  onChange={(e) => { setTotalValue(e.target.value); setDirty(true) }}
                  disabled={isLockedFromRoi}
                  className={isLockedFromRoi ? 'opacity-60' : undefined}
                />
              </div>
              <div>
                <Label htmlFor="currency" className="flex items-center gap-2">
                  {t('common.fields.currency')}
                  {isLockedFromRoi && (
                    <span className="text-[10px] uppercase font-bold tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">Do ROI</span>
                  )}
                </Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => { setCurrency(e.target.value.toUpperCase().slice(0, 3)); setDirty(true) }}
                  maxLength={3}
                  disabled={isLockedFromRoi}
                  className={isLockedFromRoi ? 'opacity-60' : undefined}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start">{t('common.fields.contractStart')}</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label htmlFor="end">{t('common.fields.contractEnd')}</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label htmlFor="signed">{t('common.fields.signing')}</Label>
                <Input id="signed" type="date" value={signedDate} onChange={(e) => { setSignedDate(e.target.value); setDirty(true) }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.fields.renewal')}</Label>
                <Combobox value={renewalType} onChange={(v) => { setRenewalType(v as RenewalType); setDirty(true) }} options={renewalOptions} />
              </div>
              <div>
                <Label htmlFor="notice">Aviso prévio (dias)</Label>
                <Input id="notice" type="number" min="0" value={noticePeriodDays} onChange={(e) => { setNoticePeriodDays(e.target.value); setDirty(true) }} />
              </div>
            </div>
            <div>
              <Label htmlFor="payment">{t('common.fields.paymentTerms')}</Label>
              <textarea
                id="payment"
                value={paymentTerms}
                onChange={(e) => { setPaymentTerms(e.target.value); setDirty(true) }}
                className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (!ctr) return
                  setName(ctr.name)
                  setStatus(ctr.status)
                  setTotalValue(String(ctr.totalValue || ''))
                  setCurrency(ctr.currency || 'BRL')
                  setStartDate(ctr.startDate || '')
                  setEndDate(ctr.endDate || '')
                  setSignedDate(ctr.signedDate || '')
                  setRenewalType(ctr.renewalType)
                  setNoticePeriodDays(String(ctr.noticePeriodDays || 30))
                  setPaymentTerms(ctr.paymentTerms || '')
                  setContractTypeKey(ctr.contractTypeKey || '')
                  setDirty(false)
                }}
                disabled={!dirty}
              >Descartar</Button>
              <Button onClick={handleSave} disabled={!dirty || update.isPending}>
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
