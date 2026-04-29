/**
 * Drawer rico de Oportunidade — Sprint #198 (UI/UX organizado).
 *
 * Seções:
 *   1. Identificação    — Nome, Responsável
 *   2. Classificação    — Status, Tipo, Empresa, Contato, Fonte
 *   3. Financeiro       — Moeda*, Valor*, Tempo de Contrato (meses), Probabilidade
 *   4. Detalhes         — Fechamento previsto, Descrição
 *   5. Auditoria        — Criação/atualização (apenas em edição)
 *
 * Campos obrigatórios: Nome, Empresa, Moeda, Valor.
 */
import { Save, UserCheck, ArrowRightLeft, Building2, Wallet, FileText, History } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import { useLeadSources } from '@/features/lead-sources/hooks/use-lead-sources'
import { useCreateOpportunity } from '@/features/opportunities/hooks/use-create-opportunity'
import { useUpdateOpportunity } from '@/features/opportunities/hooks/use-update-opportunity'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunityTypes } from '@/features/opportunity-types/hooks/use-opportunity-types'
import type { Opportunity } from '@/features/opportunities/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import { CurrencyInput } from '@/shared/ui/currency-input'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/shared/ui/sheet'

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

interface Props {
  open: boolean
  onClose: () => void
  initial?: Opportunity | null
  onSaved?: (id: string) => void
}

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

export function OpportunityFormSheet({ open, onClose, initial, onSaved }: Props) {
  const { user } = useAuth()
  const create = useCreateOpportunity()
  const update = useUpdateOpportunity(initial?.id)
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()
  const { data: companies = [] } = useCompanies()
  const { data: leadSources = [] } = useLeadSources()
  const { data: contacts = [] } = useContacts()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState('')
  const [opportunityTypeId, setOpportunityTypeId] = useState('')
  const [companyId, setCompanyId] = useState('')
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
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    setSubmitted(false)
    if (initial) {
      setName(initial.name ?? '')
      setStatusId(initial.statusId ?? '')
      setOpportunityTypeId(initial.opportunityTypeId ?? '')
      setCompanyId(initial.companyId ?? '')
      setContactId(initial.contactId ?? '')
      setLeadSourceId(initial.leadSourceId ?? '')
      setProbability(initial.probability != null ? String(initial.probability) : '')
      setExpectedCloseDate(initial.expectedCloseDate ?? '')
      setEstimatedValue(initial.estimatedValue ?? null)
      setCurrency(initial.currency ?? '')
      setContractDurationMonths(initial.contractDurationMonths != null ? String(initial.contractDurationMonths) : '')
      setDescription(initial.description ?? '')
      setResponsibleId(String(initial.responsibleId ?? ''))
      setTransferring(false)
    } else {
      setName(''); setStatusId(''); setOpportunityTypeId('')
      setCompanyId(''); setContactId(''); setLeadSourceId(''); setProbability('')
      setExpectedCloseDate(''); setEstimatedValue(null); setCurrency('')
      setContractDurationMonths(''); setDescription('')
      setResponsibleId(String(user?.id ?? ''))
      setTransferring(false)
    }
  }, [open, initial, user])

  // Reset contact when company changes
  useEffect(() => {
    if (!companyId) {
      setContactId('')
      return
    }
    const c = contacts.find((x: any) => String(x.id) === contactId)
    if (c && companyId && String((c as any).companyId) !== companyId) {
      setContactId('')
    }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const err = validate()
    if (err) return toastError(new Error(err))
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
      if (initial?.id && transferring && responsibleId !== String(initial.responsibleId)) {
        payload.responsibleId = responsibleId
      }
      const result = initial?.id
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload)
      toastSaved(initial?.id ? 'Oportunidade atualizada' : 'Oportunidade criada')
      onSaved?.(String(result.id))
      onClose()
    } catch (err) {
      toastError(err)
    }
  }

  const statusOptions = [{ value: '', label: '— sem status —' }, ...statuses.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))]
  const typeOptions = [{ value: '', label: '— sem tipo —' }, ...types.filter((tp) => tp.active).map((tp) => ({ value: tp.id, label: tp.name }))]
  const companyOptions = [{ value: '', label: '— selecione —' }, ...companies.filter((c: any) => c.active !== false).map((c: any) => ({ value: String(c.id), label: c.name }))]
  const leadSourceOptions = [{ value: '', label: '— sem fonte —' }, ...leadSources.filter((l: any) => l.active !== false).map((l: any) => ({ value: String(l.id), label: l.name }))]
  const currencyOptions = [{ value: '', label: '— selecione —' }, ...CURRENCIES]

  const contactOptions = useMemo(() => {
    const filtered = companyId
      ? contacts.filter((c: any) => String(c.companyId) === companyId)
      : contacts
    return [{ value: '', label: '— sem contato —' }, ...filtered.filter((c: any) => c.active !== false).map((c: any) => ({
      value: String(c.id),
      label: c.name + (c.role ? ` · ${c.role}` : ''),
    }))]
  }, [contacts, companyId])

  const userOptions = tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))
  const responsibleName = tenantUsers.find(u => String(u.id) === responsibleId)?.name
    || tenantUsers.find(u => String(u.id) === responsibleId)?.email
    || '—'
  const isCurrentResponsible = initial?.id && String(user?.id) === String(initial.responsibleId)
  const canTransfer = !initial?.id ? false : (isCurrentResponsible || user?.isMaster)

  // Indicadores visuais de campo obrigatório (só após submit OU se field foi tocado)
  const errCompany = submitted && !companyId
  const errCurrency = submitted && !currency
  const errValue = submitted && (estimatedValue == null || estimatedValue <= 0)
  const errName = submitted && !name.trim()

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{initial?.id ? 'Editar oportunidade' : 'Nova oportunidade'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <SheetBody className="space-y-6">
            {/* SEÇÃO 1: Identificação */}
            <Section icon={UserCheck} title="Identificação">
              <div className="space-y-1">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required
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
                    <Combobox options={userOptions} value={responsibleId} onChange={setResponsibleId} placeholder="Selecione novo responsável..." />
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setResponsibleId(String(initial?.responsibleId ?? '')); setTransferring(false) }}>Cancelar</Button>
                  </div>
                )}
              </div>
            </Section>

            {/* SEÇÃO 2: Classificação */}
            <Section icon={Building2} title="Classificação">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Empresa <span className="text-destructive">*</span></Label>
                  <Combobox options={companyOptions} value={companyId} onChange={setCompanyId} />
                  {errCompany && <p className="text-xs text-destructive">Empresa é obrigatória</p>}
                </div>
                <div className="space-y-1">
                  <Label>Contato</Label>
                  <Combobox
                    options={contactOptions}
                    value={contactId}
                    onChange={setContactId}
                    placeholder={companyId ? 'Selecione...' : 'Escolha uma empresa primeiro'}
                    disabled={!companyId && contacts.length > 0 && contacts.every((c: any) => c.companyId)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Combobox options={statusOptions} value={statusId} onChange={setStatusId} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Combobox options={typeOptions} value={opportunityTypeId} onChange={setOpportunityTypeId} />
                </div>
                <div className="space-y-1">
                  <Label>Fonte do Lead</Label>
                  <Combobox options={leadSourceOptions} value={leadSourceId} onChange={setLeadSourceId} />
                </div>
              </div>
            </Section>

            {/* SEÇÃO 3: Financeiro */}
            <Section icon={Wallet} title="Financeiro">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Moeda <span className="text-destructive">*</span></Label>
                  <Combobox options={currencyOptions} value={currency} onChange={setCurrency} />
                  {errCurrency && <p className="text-xs text-destructive">Moeda é obrigatória</p>}
                </div>
                <div className="space-y-1">
                  <Label>Valor estimado <span className="text-destructive">*</span></Label>
                  <CurrencyInput value={estimatedValue} currency={currency || 'BRL'} onChange={setEstimatedValue} />
                  {errValue && <p className="text-xs text-destructive">Informe o valor</p>}
                </div>
                <div className="space-y-1">
                  <Label>Probabilidade</Label>
                  <Combobox options={[{ value: '', label: '—' }, ...PROBABILITIES]} value={probability} onChange={setProbability} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tempo de contrato (meses)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={contractDurationMonths}
                    onChange={(e) => setContractDurationMonths(e.target.value)}
                    placeholder="ex: 12"
                  />
                  <p className="text-xs text-muted-foreground">Inteiro entre 1 e 60 (opcional)</p>
                </div>
                <div className="space-y-1">
                  <Label>Fechamento previsto</Label>
                  <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
                </div>
              </div>
            </Section>

            {/* SEÇÃO 4: Detalhes */}
            <Section icon={FileText} title="Detalhes">
              <div className="space-y-1">
                <Label>Descrição</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas, escopo, observações…"
                />
              </div>
            </Section>

            {/* SEÇÃO 5: Auditoria (só em edição) */}
            {initial?.id && (
              <Section icon={History} title="Auditoria">
                <AuditInfoFooter
                  createdAt={initial.createdAt}
                  updatedAt={initial.updatedAt}
                  createdByName={tenantUsers.find(u => String(u.id) === String(initial.createdBy))?.name || tenantUsers.find(u => String(u.id) === String(initial.createdBy))?.email}
                />
              </Section>
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {initial?.id ? 'Salvar' : 'Criar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
