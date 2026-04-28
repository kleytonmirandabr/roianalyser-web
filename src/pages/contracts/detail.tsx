/**
 * Detalhe de Contrato — módulo isolado (Sprint 3 Batch B).
 *
 * Edição inline + soft delete. Linkagem visível com Oportunidade origem
 * (quando `opportunityId` está preenchido). Próximas iterações trazem
 * Anexos, Pagamentos, Renovações.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.4.
 */

import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ctr, isLoading, error } = useContract(id)
  const { data: relatedProjects = [] } = useProjects2(id ? { contractId: id } : {})
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

  const statusOptions = CONTRACT_STATUSES.map((s) => ({
    value: s,
    label: CONTRACT_STATUS_LABELS[s],
  }))

  const renewalOptions = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map((k) => ({
    value: k,
    label: RENEWAL_TYPE_LABELS[k],
  }))

  async function handleSave() {
    if (!ctr) return
    if (startDate && endDate && endDate < startDate) {
      toastError('Data fim não pode ser anterior ao início')
      return
    }
    try {
      await update.mutateAsync({
        name: name.trim() || ctr.name,
        status,
        contractTypeKey: contractTypeKey.trim() || null,
        totalValue: Number(totalValue) || 0,
        currency,
        startDate: startDate || null,
        endDate: endDate || null,
        signedDate: signedDate || null,
        renewalType,
        noticePeriodDays: Number(noticePeriodDays) || 30,
        paymentTerms: paymentTerms.trim() || null,
      })
      toastSaved('Contrato atualizado')
      setDirty(false)
    } catch (err) {
      toastError(`Erro ao salvar: ${(err as Error).message}`)
    }
  }

  async function handleDelete() {
    if (!ctr) return
    const ok = await confirm({
      title: 'Excluir contrato?',
      description: `${ctr.contractNumber} — ${ctr.name} será excluído (soft delete).`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(ctr.id)
      toastDeleted('Contrato excluído')
      navigate('/contracts')
    } catch (err) {
      toastError(`Erro ao excluir: ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!ctr) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Contrato não encontrado.</AlertDescription>
        </Alert>
      </div>
    )
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground mr-2">
              {ctr.contractNumber}
            </span>
            {ctr.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado {new Date(ctr.createdAt).toLocaleDateString('pt-BR')}
            {ctr.signedDate && ` · Assinado ${new Date(ctr.signedDate).toLocaleDateString('pt-BR')}`}
            {ctr.terminatedAt && ` · Terminado ${new Date(ctr.terminatedAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </div>

      {ctr.opportunityId && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase">Oportunidade origem</span>
              <p className="text-sm font-medium">Oportunidade #{ctr.opportunityId}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/opportunities/${ctr.opportunityId}`}>
                <ExternalLink className="h-4 w-4" />
                Ver oportunidade
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">Informações</h2>

        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true) }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Combobox
              value={status}
              onChange={(v) => { setStatus(v as ContractStatus); setDirty(true) }}
              options={statusOptions}
            />
          </div>
          <div>
            <Label htmlFor="ctype">Tipo</Label>
            <Input
              id="ctype"
              value={contractTypeKey}
              onChange={(e) => { setContractTypeKey(e.target.value); setDirty(true) }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="value">Valor total</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={totalValue}
              onChange={(e) => { setTotalValue(e.target.value); setDirty(true) }}
            />
          </div>
          <div>
            <Label htmlFor="currency">Moeda</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value.toUpperCase().slice(0, 3))
                setDirty(true)
              }}
              maxLength={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="start">Início</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDirty(true) }}
            />
          </div>
          <div>
            <Label htmlFor="end">Fim</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDirty(true) }}
            />
          </div>
          <div>
            <Label htmlFor="signed">Assinatura</Label>
            <Input
              id="signed"
              type="date"
              value={signedDate}
              onChange={(e) => { setSignedDate(e.target.value); setDirty(true) }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Renovação</Label>
            <Combobox
              value={renewalType}
              onChange={(v) => { setRenewalType(v as RenewalType); setDirty(true) }}
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
              onChange={(e) => { setNoticePeriodDays(e.target.value); setDirty(true) }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="payment">Termos de pagamento</Label>
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
          >
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Card>

      {/* Card "Projetos derivados" — disponível em contratos active+.
          Permite iniciar projeto com contractId pré-preenchido. */}
      {(ctr.status === 'active' || ctr.status === 'ending_soon' ||
        ctr.status === 'ended' || relatedProjects.length > 0) && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Projetos derivados ({relatedProjects.length})</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Inicie projetos a partir deste contrato.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to={`/projects-v2/new?contractId=${ctr.id}`}>
                <Plus className="h-4 w-4" />Iniciar projeto
              </Link>
            </Button>
          </div>
          {relatedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum projeto iniciado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedProjects.map(p => (
                <li key={p.id}>
                  <Link
                    to={`/projects-v2/${p.id}`}
                    className="flex items-center justify-between rounded border p-3 hover:bg-muted/30"
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {p.projectCode}
                      </span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {p.progressPct.toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground">{PROJECT_STATUS_LABELS[p.status]}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <CustomFieldsCard scope="contract" entityType="contract" entityId={id} />
    </div>
  )
}
