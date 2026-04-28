/**
 * Form de novo Contrato — módulo isolado (Sprint 3 Batch B).
 *
 * Cria via POST /api/contracts2. Backend gera contract_number automático
 * (CT-YYYY-NNN) se omitido. opportunityId opcional na fase 1; quando
 * vier do botão "+ Gerar contrato" da Oportunidade, preencher aqui.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.4.
 */

import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCreateContract } from '@/features/contracts2/hooks/use-create-contract'
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  RENEWAL_TYPE_LABELS,
  type ContractStatus,
  type RenewalType,
} from '@/features/contracts2/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export function NewContractPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const fromOpportunityId = searchParams.get('opportunityId')
  const create = useCreateContract()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ContractStatus>('drafting')
  const [contractTypeKey, setContractTypeKey] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('manual')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('')

  const statusOptions = CONTRACT_STATUSES.map((s) => ({
    value: s,
    label: CONTRACT_STATUS_LABELS[s],
  }))

  const renewalOptions = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map((k) => ({
    value: k,
    label: RENEWAL_TYPE_LABELS[k],
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toastError('O nome do contrato é obrigatório')
      return
    }
    const valueNum = Number(totalValue)
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      toastError('Valor total é obrigatório e deve ser positivo')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      toastError('Data fim não pode ser anterior ao início')
      return
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        status,
        opportunityId: fromOpportunityId || null,
        contractTypeKey: contractTypeKey.trim() || null,
        totalValue: valueNum,
        currency,
        startDate: startDate || null,
        endDate: endDate || null,
        renewalType,
        noticePeriodDays: Number(noticePeriodDays) || 30,
        paymentTerms: paymentTerms.trim() || null,
      })
      toastSaved(`Contrato ${created.contractNumber} criado`)
      navigate(`/contracts/${created.id}`)
    } catch (err) {
      toastError(`Erro ao criar: ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/contracts">
            <ArrowLeft className="h-4 w-4" />
            Contratos
          </Link>
        </Button>
      </header>

      <div>
        <h1 className="text-2xl font-semibold">Novo contrato</h1>
        <p className="text-sm text-muted-foreground">
          Cliente vinculado: <strong>{String(user?.clientName || 'tenant atual')}</strong> ·
          Responsável: <strong>{String(user?.name || '')}</strong>
          {fromOpportunityId && (
            <> · Origem: <strong>Oportunidade #{fromOpportunityId}</strong></>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Número do contrato será gerado automaticamente (CT-{new Date().getFullYear()}-NNN).
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-5">
          <div>
            <Label htmlFor="name">Nome do contrato *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: ACME — Implantação sistema X"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status inicial</Label>
              <Combobox
                value={status}
                onChange={(v) => setStatus(v as ContractStatus)}
                options={statusOptions}
              />
            </div>
            <div>
              <Label htmlFor="contractType">Tipo de contrato</Label>
              <Input
                id="contractType"
                value={contractTypeKey}
                onChange={(e) => setContractTypeKey(e.target.value)}
                placeholder="Ex: SaaS Anual, Implantação..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="value">Valor total *</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="currency">Moeda</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Início da vigência</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end">Fim da vigência</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de renovação</Label>
              <Combobox
                value={renewalType}
                onChange={(v) => setRenewalType(v as RenewalType)}
                options={renewalOptions}
              />
            </div>
            <div>
              <Label htmlFor="notice">Aviso prévio (dias)</Label>
              <Input
                id="notice"
                type="number"
                min="0"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="payment">Termos de pagamento</Label>
            <textarea
              id="payment"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ex: Mensalidade no dia 5, multa 2% após 10 dias..."
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button asChild variant="outline" type="button">
              <Link to="/contracts">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : 'Criar contrato'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
