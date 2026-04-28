/**
 * Drawer rico para criar/editar oportunidade.
 * Sprint #196 — adiciona Empresa, Fonte do Lead, Probabilidade,
 * Moeda em listbox, Responsável read-only com botão Transferir.
 */
import { Save, UserCheck, ArrowRightLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompanies } from '@/features/companies/hooks/use-companies'
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
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '40', label: '40%' },
  { value: '50', label: '50% — Em equilíbrio' },
  { value: '60', label: '60%' },
  { value: '70', label: '70% — Provável' },
  { value: '80', label: '80%' },
  { value: '90', label: '90% — Muito provável' },
  { value: '100', label: '100% — Certa' },
]

interface Props {
  open: boolean
  onClose: () => void
  initial?: Opportunity | null
  onSaved?: (id: string) => void
}

export function OpportunityFormSheet({ open, onClose, initial, onSaved }: Props) {
  const { user } = useAuth()
  const create = useCreateOpportunity()
  const update = useUpdateOpportunity(initial?.id)
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()
  const { data: companies = [] } = useCompanies()
  const { data: leadSources = [] } = useLeadSources()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState('')
  const [opportunityTypeId, setOpportunityTypeId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [leadSourceId, setLeadSourceId] = useState('')
  const [probability, setProbability] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [description, setDescription] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name ?? '')
      setStatusId(initial.statusId ?? '')
      setOpportunityTypeId(initial.opportunityTypeId ?? '')
      setCompanyId(initial.companyId ?? '')
      setLeadSourceId(initial.leadSourceId ?? '')
      setProbability(initial.probability != null ? String(initial.probability) : '')
      setExpectedCloseDate(initial.expectedCloseDate ?? '')
      setEstimatedValue(initial.estimatedValue != null ? String(initial.estimatedValue) : '')
      setCurrency(initial.currency ?? 'BRL')
      setDescription(initial.description ?? '')
      setResponsibleId(String(initial.responsibleId ?? ''))
      setTransferring(false)
    } else {
      setName(''); setStatusId(''); setOpportunityTypeId('')
      setCompanyId(''); setLeadSourceId(''); setProbability('')
      setExpectedCloseDate(''); setEstimatedValue(''); setCurrency('BRL')
      setDescription(''); setResponsibleId(String(user?.id ?? ''))
      setTransferring(false)
    }
  }, [open, initial, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError(new Error('Informe o nome da oportunidade'))
    try {
      const payload: any = {
        name: name.trim(),
        statusId: statusId || null,
        opportunityTypeId: opportunityTypeId || null,
        companyId: companyId || null,
        leadSourceId: leadSourceId || null,
        probability: probability !== '' ? Number(probability) : null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        currency: currency || 'BRL',
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      }
      // Apenas envia responsibleId se for transferência (UX explícita)
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
  const companyOptions = [{ value: '', label: '— sem empresa —' }, ...companies.filter((c: any) => c.active !== false).map((c: any) => ({ value: String(c.id), label: c.name }))]
  const leadSourceOptions = [{ value: '', label: '— sem fonte —' }, ...leadSources.filter((l: any) => l.active !== false).map((l: any) => ({ value: String(l.id), label: l.name }))]
  const userOptions = tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))

  const responsibleName = tenantUsers.find(u => String(u.id) === responsibleId)?.name
    || tenantUsers.find(u => String(u.id) === responsibleId)?.email
    || '—'
  const isCurrentResponsible = initial?.id && String(user?.id) === String(initial.responsibleId)
  const canTransfer = !initial?.id ? false : (isCurrentResponsible || user?.isMaster)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial?.id ? 'Editar oportunidade' : 'Nova oportunidade'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>

            {/* Responsável read-only com botão Transferir */}
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
              {!isCurrentResponsible && !user?.isMaster && initial?.id && (
                <p className="text-xs text-muted-foreground">Apenas o responsável atual pode transferir.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Combobox options={statusOptions} value={statusId} onChange={setStatusId} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Combobox options={typeOptions} value={opportunityTypeId} onChange={setOpportunityTypeId} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Combobox options={companyOptions} value={companyId} onChange={setCompanyId} />
              </div>
              <div className="space-y-1">
                <Label>Fonte do Lead</Label>
                <Combobox options={leadSourceOptions} value={leadSourceId} onChange={setLeadSourceId} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Valor estimado</Label>
                <Input type="number" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Moeda</Label>
                <Combobox options={CURRENCIES} value={currency} onChange={setCurrency} />
              </div>
              <div className="space-y-1">
                <Label>Probabilidade</Label>
                <Combobox options={[{ value: '', label: '—' }, ...PROBABILITIES]} value={probability} onChange={setProbability} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Fechamento previsto</Label>
              <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {initial?.id && (
              <AuditInfoFooter
                createdAt={initial.createdAt}
                updatedAt={initial.updatedAt}
                createdByName={tenantUsers.find(u => String(u.id) === String(initial.createdBy))?.name || tenantUsers.find(u => String(u.id) === String(initial.createdBy))?.email}
              />
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
