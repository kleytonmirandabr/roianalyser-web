/**
 * Detalhe de Oportunidade — página dedicada com layout consistente
 * com o OpportunityFormSheet (drawer). Sprint #210.
 *
 * 5 seções principais (Identificação · Classificação · Financeiro ·
 * Detalhes · Auditoria) + cards complementares: Análise de ROI,
 * Contratos relacionados, Custom fields.
 */
import {
  ArrowLeft, Plus, Trash2, Save, UserCheck, Building2, Wallet,
  FileText, History, ArrowRightLeft,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import { useLeadSources } from '@/features/lead-sources/hooks/use-lead-sources'
import { DeleteWithReasonDialog } from '@/features/opportunities/components/delete-with-reason-dialog'
import { useDeleteOpportunity } from '@/features/opportunities/hooks/use-delete-opportunity'
import { useOpportunity } from '@/features/opportunities/hooks/use-opportunity'
import { useUpdateOpportunity } from '@/features/opportunities/hooks/use-update-opportunity'
import { useContracts } from '@/features/contracts2/hooks/use-contracts'
import { ContractFormSheet } from '@/features/contracts2/components/contract-form-sheet'
import { ProjectFormSheet } from '@/features/projects2/components/project-form-sheet'
import { useProjects2 } from '@/features/projects2/hooks/use-projects'
import { PROJECT_STATUS_LABELS } from '@/features/projects2/types'
import { CONTRACT_STATUS_LABELS } from '@/features/contracts2/types'
import { useCreateRoiAnalysis } from '@/features/roi-analyses/hooks/use-create-roi'
import { useRoiAnalysesByOpportunity } from '@/features/roi-analyses/hooks/use-roi-analyses'
import { ROI_STATUS_LABELS } from '@/features/roi-analyses/types'
import { formatCurrencyShort, formatDateTime } from '@/shared/lib/format'
import { useUserTimezone } from '@/shared/lib/use-user-timezone'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunityTypes } from '@/features/opportunity-types/hooks/use-opportunity-types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { CurrencyInput } from '@/shared/ui/currency-input'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'

const CURRENCIES = [
  { value: 'BRL', label: 'BRL — Real Brasileiro (R$)' },
  { value: 'USD', label: 'USD — Dólar Americano ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'ARS', label: 'ARS — Peso Argentino' },
  { value: 'CLP', label: 'CLP — Peso Chileno' },
  { value: 'MXN', label: 'MXN — Peso Mexicano' },
  { value: 'GBP', label: 'GBP — Libra Esterlina (£)' },
]
const PROBABILITIES = [
  { value: '0', label: '0% — Sem chance' },
  { value: '10', label: '10%' }, { value: '20', label: '20%' },
  { value: '30', label: '30%' }, { value: '40', label: '40%' },
  { value: '50', label: '50% — Em equilíbrio' },
  { value: '60', label: '60%' }, { value: '70', label: '70% — Provável' },
  { value: '80', label: '80%' }, { value: '90', label: '90% — Muito provável' },
  { value: '100', label: '100% — Certa' },
]

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: any }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tz = useUserTimezone()
  const { user } = useAuth()

  const { data: opp, isLoading, error } = useOpportunity(id)
  const { data: roiAnalyses = [] } = useRoiAnalysesByOpportunity(id)
  const { data: relatedContracts = [] } = useContracts(id ? { opportunityId: id } : {})
  const { data: relatedProjects = [] } = useProjects2(id ? { opportunityId: id } : {})
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()
  const { data: companies = [] } = useCompanies()
  const { data: leadSources = [] } = useLeadSources()
  const { data: contacts = [] } = useContacts()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const update = useUpdateOpportunity(id)
  const remove = useDeleteOpportunity()
  const createRoi = useCreateRoiAnalysis()

  const hasApprovedRoi = roiAnalyses.some(r => r.status === 'approved')
  // ROI aprovado mais recente (maior versão / createdAt) — pré-fill do contrato
  const approvedRoi = (() => {
    const approved = roiAnalyses.filter((r: any) => r.status === 'approved')
    if (approved.length === 0) return null
    return approved.reduce((best: any, r: any) =>
      !best || (r.version || 0) > (best.version || 0) ? r : best,
    null as any)
  })()

  // Form state — espelha o drawer
  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState('')
  const [opportunityTypeId, setOpportunityTypeId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false)
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false)
  const [contactId, setContactId] = useState('')
  const [leadSourceId, setLeadSourceId] = useState('')
  const [probability, setProbability] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [estimatedValue, setEstimatedValue] = useState<number | null>(null)
  const [currency, setCurrency] = useState('')
  const [contractDurationMonths, setContractDurationMonths] = useState<string>('')
  const [description, setDescription] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!opp) return
    setName(opp.name || '')
    setStatusId(opp.statusId || '')
    setOpportunityTypeId(opp.opportunityTypeId || '')
    setCompanyId(opp.companyId || '')
    setContactId(opp.contactId || '')
    setLeadSourceId(opp.leadSourceId || '')
    setProbability(opp.probability != null ? String(opp.probability) : '')
    setExpectedCloseDate(opp.expectedCloseDate || '')
    setEstimatedValue(opp.estimatedValue ?? null)
    setCurrency(opp.currency || '')
    setContractDurationMonths(opp.contractDurationMonths != null ? String(opp.contractDurationMonths) : '')
    setDescription(opp.description || '')
    setResponsibleId(String(opp.responsibleId ?? ''))
    setTransferring(false)
    setDirty(false)
    setSubmitted(false)
  }, [opp])

  // Reset contact when company changes
  useEffect(() => {
    if (!companyId) { setContactId(''); return }
    const c = (contacts as any[]).find((x: any) => String(x.id) === contactId)
    if (c && companyId && String((c as any).companyId) !== companyId) setContactId('')
  }, [companyId, contacts])

  function validate(): string | null {
    if (!name.trim()) return 'Informe o nome da oportunidade'
    if (!companyId) return 'Selecione a empresa'
    if (!currency) return 'Selecione a moeda'
    if (estimatedValue == null || estimatedValue <= 0) return 'Informe o valor estimado'
    if (contractDurationMonths) {
      const n = Number(contractDurationMonths)
      if (!Number.isInteger(n) || n < 1 || n > 60) return 'Tempo de contrato deve estar entre 1 e 60 meses'
    }
    return null
  }

  async function handleSave() {
    setSubmitted(true)
    const err = validate()
    if (err) return toastError(new Error(err))
    if (!opp) return
    try {
      const payload: any = {
        name: name.trim(),
        statusId: statusId || null,
        opportunityTypeId: opportunityTypeId || null,
        companyId,
        contactId: contactId || null,
        leadSourceId: leadSourceId || null,
        probability: probability !== '' ? Number(probability) : null,
        estimatedValue,
        currency,
        contractDurationMonths: contractDurationMonths ? Number(contractDurationMonths) : null,
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      }
      if (transferring && responsibleId !== String(opp.responsibleId)) {
        payload.responsibleId = responsibleId
      }
      await update.mutateAsync(payload)
      toastSaved('Oportunidade salva')
      setDirty(false)
      setTransferring(false)
    } catch (e) {
      toastError(e)
    }
  }

  function discardChanges() {
    if (!opp) return
    setName(opp.name || '')
    setStatusId(opp.statusId || '')
    setOpportunityTypeId(opp.opportunityTypeId || '')
    setCompanyId(opp.companyId || '')
    setContactId(opp.contactId || '')
    setLeadSourceId(opp.leadSourceId || '')
    setProbability(opp.probability != null ? String(opp.probability) : '')
    setExpectedCloseDate(opp.expectedCloseDate || '')
    setEstimatedValue(opp.estimatedValue ?? null)
    setCurrency(opp.currency || '')
    setContractDurationMonths(opp.contractDurationMonths != null ? String(opp.contractDurationMonths) : '')
    setDescription(opp.description || '')
    setResponsibleId(String(opp.responsibleId ?? ''))
    setTransferring(false)
    setDirty(false)
  }

  function handleDelete() { setDeleteOpen(true) }
  async function confirmDelete(input: { reasonId: string; note: string | null }) {
    if (!opp) return
    try {
      await remove.mutateAsync({ id: opp.id, ...input })
      toastDeleted('Oportunidade excluída')
      setDeleteOpen(false)
      navigate('/opportunities')
    } catch (e) {
      toastError(e)
    }
  }

  // Lookups
  const statusOptions = [{ value: '', label: '— sem status —' }, ...statuses.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))]
  const typeOptions = [{ value: '', label: '— sem tipo —' }, ...types.filter(t => t.active).map(t => ({ value: t.id, label: t.name }))]
  const companyOptions = [{ value: '', label: '— selecione —' }, ...(companies as any[]).filter((c: any) => c.active !== false).map((c: any) => ({ value: String(c.id), label: c.name }))]
  const leadSourceOptions = [{ value: '', label: '— sem fonte —' }, ...(leadSources as any[]).filter((l: any) => l.active !== false).map((l: any) => ({ value: String(l.id), label: l.name }))]
  const currencyOptions = [{ value: '', label: '— selecione —' }, ...CURRENCIES]
  const contactOptions = useMemo(() => {
    const filtered = companyId
      ? (contacts as any[]).filter((c: any) => String(c.companyId) === companyId)
      : (contacts as any[])
    return [{ value: '', label: '— sem contato —' }, ...filtered.filter((c: any) => c.active !== false).map((c: any) => ({
      value: String(c.id),
      label: c.name + (c.role ? ` · ${c.role}` : ''),
    }))]
  }, [contacts, companyId])
  const userOptions = tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))
  const responsibleName = tenantUsers.find(u => String(u.id) === responsibleId)?.name
    || tenantUsers.find(u => String(u.id) === responsibleId)?.email
    || '—'
  const isCurrentResponsible = opp?.id && String(user?.id) === String(opp.responsibleId)
  const canTransfer = !opp?.id ? false : (isCurrentResponsible || user?.isMaster)
  const currentStatus = statusId ? statuses.find(s => s.id === statusId) : null

  const errCompany = submitted && !companyId
  const errCurrency = submitted && !currency
  const errValue = submitted && (estimatedValue == null || estimatedValue <= 0)
  const errName = submitted && !name.trim()

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar: {(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!opp) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Oportunidade não encontrada.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Mark dirty on any change
  function setAndDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto">
      <Link to="/opportunities" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4 mr-1" /> Oportunidades
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{opp.name}</h1>
          <p className="text-sm text-muted-foreground">
            ID #{opp.id} · Criada {new Date(opp.createdAt).toLocaleDateString('pt-BR')}
            {opp.wonAt && ` · Ganha em ${new Date(opp.wonAt).toLocaleDateString('pt-BR')}`}
            {opp.lostAt && ` · Perdida em ${new Date(opp.lostAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Excluir
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Card principal — 5 seções espelhando o drawer */}
      <Card className="p-6 space-y-6">
        <Section icon={UserCheck} title="Identificação">
          <div className="space-y-1">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setAndDirty(setName)(e.target.value)} required
              className={errName ? 'border-destructive' : ''} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            {!transferring ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span>{responsibleName}</span>
                </div>
                {canTransfer && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setTransferring(true)}>
                    <ArrowRightLeft className="h-4 w-4 mr-1" /> Transferir
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Combobox options={userOptions} value={responsibleId}
                  onChange={(v) => { setResponsibleId(v); setDirty(true) }}
                  placeholder="Selecione novo responsável..." />
                <Button type="button" variant="ghost" size="sm" onClick={() => { setResponsibleId(String(opp.responsibleId ?? '')); setTransferring(false); setDirty(false) }}>Cancelar</Button>
              </div>
            )}
          </div>
        </Section>

        <Section icon={Building2} title="Classificação">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Empresa <span className="text-destructive">*</span></Label>
              <Combobox options={companyOptions} value={companyId} onChange={setAndDirty(setCompanyId)} />
              {errCompany && <p className="text-xs text-destructive">Empresa é obrigatória</p>}
            </div>
            <div className="space-y-1">
              <Label>Contato</Label>
              <Combobox options={contactOptions} value={contactId} onChange={setAndDirty(setContactId)}
                placeholder={companyId ? 'Selecione...' : 'Escolha uma empresa primeiro'}
                disabled={!companyId && (contacts as any[]).length > 0 && (contacts as any[]).every((c: any) => c.companyId)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Combobox options={statusOptions} value={statusId} onChange={setAndDirty(setStatusId)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Combobox options={typeOptions} value={opportunityTypeId} onChange={setAndDirty(setOpportunityTypeId)} />
            </div>
            <div className="space-y-1">
              <Label>Fonte do Lead</Label>
              <Combobox options={leadSourceOptions} value={leadSourceId} onChange={setAndDirty(setLeadSourceId)} />
            </div>
          </div>
        </Section>

        <Section icon={Wallet} title="Financeiro">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Moeda <span className="text-destructive">*</span></Label>
              <Combobox options={currencyOptions} value={currency} onChange={setAndDirty(setCurrency)} />
              {errCurrency && <p className="text-xs text-destructive">Moeda é obrigatória</p>}
            </div>
            <div className="space-y-1">
              <Label>Valor estimado <span className="text-destructive">*</span></Label>
              <CurrencyInput value={estimatedValue} currency={currency || 'BRL'} onChange={(v) => { setEstimatedValue(v); setDirty(true) }} />
              {errValue && <p className="text-xs text-destructive">Informe o valor</p>}
            </div>
            <div className="space-y-1">
              <Label>Probabilidade</Label>
              <Combobox options={[{ value: '', label: '—' }, ...PROBABILITIES]} value={probability} onChange={setAndDirty(setProbability)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tempo de contrato (meses)</Label>
              <Input type="number" min={1} max={60} step={1}
                value={contractDurationMonths}
                onChange={(e) => setAndDirty(setContractDurationMonths)(e.target.value)}
                placeholder="ex: 12" />
              <p className="text-xs text-muted-foreground">Inteiro entre 1 e 60 (opcional)</p>
            </div>
            <div className="space-y-1">
              <Label>Fechamento previsto</Label>
              <Input type="date" value={expectedCloseDate}
                onChange={(e) => setAndDirty(setExpectedCloseDate)(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section icon={FileText} title="Detalhes">
          <div className="space-y-1">
            <Label>Descrição</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={description}
              onChange={(e) => setAndDirty(setDescription)(e.target.value)}
              placeholder="Notas, escopo, observações…"
            />
          </div>
        </Section>

        <Section icon={History} title="Auditoria">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Criada em</div>
              <div className="text-sm">{formatDateTime(opp.createdAt, tz)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Atualizada em</div>
              <div className="text-sm">{formatDateTime(opp.updatedAt, tz)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Criada por</div>
              <div className="text-sm">{tenantUsers.find(u => String(u.id) === String(opp.createdBy))?.name || tenantUsers.find(u => String(u.id) === String(opp.createdBy))?.email || '—'}</div>
            </div>
          </div>
        </Section>

        <div className="flex gap-2 justify-end pt-3 border-t">
          <Button variant="outline" type="button" onClick={discardChanges} disabled={!dirty}>
            Descartar mudanças
          </Button>
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            <Save className="h-4 w-4 mr-1" /> {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Card>

        </div>

        <aside className="space-y-4">
          {/* Análise de ROI */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Análise de ROI ({roiAnalyses.length})</h2>
            <p className="text-xs text-muted-foreground mt-1">Análises versionadas. ROI aprovado destrava criação de contrato.</p>
          </div>
          <Button size="sm" disabled={createRoi.isPending}
            onClick={async () => {
              if (!opp) return
              try {
                const r = await createRoi.mutateAsync({ opportunityId: opp.id, name: `Análise ${new Date().toLocaleDateString('pt-BR')}` })
                toastSaved(`ROI v${r.version} criado`)
                navigate(`/roi-analyses/${r.id}`)
              } catch (err) {
                toastError(`Erro: ${(err as Error).message}`)
              }
            }}>
            <Plus className="h-4 w-4 mr-1" /> Nova revisão
          </Button>
        </div>
        {roiAnalyses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma análise ainda. Clique em "Nova revisão" pra começar.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {roiAnalyses.map((roi: any) => (
              <li key={roi.id}>
                <Link to={`/roi-analyses/${roi.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">v{roi.version}</span>
                    <span className="text-muted-foreground">{roi.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {roi.netValue != null && <span className="tabular-nums text-muted-foreground">{formatCurrencyShort(roi.netValue, roi.currency)}</span>}
                    <span className="text-muted-foreground">{ROI_STATUS_LABELS[roi.status]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Contratos relacionados */}
      {(currentStatus?.category === 'gain' || hasApprovedRoi || relatedContracts.length > 0) && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Contratos relacionados ({relatedContracts.length})</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {hasApprovedRoi || currentStatus?.category === 'gain'
                  ? 'Gere contratos a partir desta oportunidade.'
                  : 'Aprove uma análise de ROI pra liberar geração de contrato.'}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setContractDrawerOpen(true)}
              disabled={!hasApprovedRoi && currentStatus?.category !== 'gain'}
            >
              <Plus className="h-4 w-4 mr-1" /> Gerar contrato
            </Button>
          </div>
          {relatedContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato gerado ainda.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {relatedContracts.map((c: any) => (
                <li key={c.id}>
                  <Link to={`/contracts/${c.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {c.value != null && <span className="tabular-nums text-muted-foreground">{formatCurrencyShort(c.value, c.currency)}</span>}
                      <span className="text-muted-foreground">{CONTRACT_STATUS_LABELS[c.status]}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Projetos relacionados (Phase 1 P.6) */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Projetos relacionados ({relatedProjects.length})</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Inicie um projeto a partir desta oportunidade. O projeto fica vinculado mesmo sem contrato.
            </p>
          </div>
          <Button size="sm" onClick={() => setProjectDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Iniciar projeto
          </Button>
        </div>
        {relatedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto vinculado ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {relatedProjects.map((p: any) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.projectCode && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.projectCode}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {p.progressPct != null && <span className="tabular-nums text-muted-foreground">{p.progressPct}%</span>}
                    <span className="text-muted-foreground">{PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] || p.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomFieldsCard scope="opportunity" entityType="opportunity" entityId={id} />
        </aside>
      </div>

      <DeleteWithReasonDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} count={1} onConfirm={confirmDelete} pending={remove.isPending} />
      <ContractFormSheet
        open={contractDrawerOpen}
        onClose={() => setContractDrawerOpen(false)}
        fromOpportunityId={opp.id}
        preselectCompanyId={opp.companyId || null}
        approvedRoiId={approvedRoi?.id ?? null}
      />
      <ProjectFormSheet
        open={projectDrawerOpen}
        onClose={() => setProjectDrawerOpen(false)}
        fromOpportunityId={opp.id}
      />
    </div>
  )
}
