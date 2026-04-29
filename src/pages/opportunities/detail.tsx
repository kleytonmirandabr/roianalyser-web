/**
 * Detalhe de Oportunidade — módulo isolado (Sprint 2 Batch B).
 *
 * Edição inline: campos podem ser editados e salvos via PATCH /api/opportunities/:id.
 * Inclui transições de status (auto-stamp wonAt/lostAt no backend).
 *
 * Próximas iterações (Batches C/D):
 *   - Aba "Análise de ROI" (Sprint 5)
 *   - Linkagens (Contratos relacionados)
 *   - Custom fields (form_fields scope=opportunity)
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.2.
 */

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { DeleteWithReasonDialog } from '@/features/opportunities/components/delete-with-reason-dialog'
import { useDeleteOpportunity } from '@/features/opportunities/hooks/use-delete-opportunity'
import { useOpportunity } from '@/features/opportunities/hooks/use-opportunity'
import { useUpdateOpportunity } from '@/features/opportunities/hooks/use-update-opportunity'
import { useContracts } from '@/features/contracts2/hooks/use-contracts'
import { CONTRACT_STATUS_LABELS } from '@/features/contracts2/types'
import { useCreateRoiAnalysis } from '@/features/roi-analyses/hooks/use-create-roi'
import { useRoiAnalysesByOpportunity } from '@/features/roi-analyses/hooks/use-roi-analyses'
import { ROI_STATUS_LABELS } from '@/features/roi-analyses/types'
import { formatCurrencyShort } from '@/shared/lib/format'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunityTypes } from '@/features/opportunity-types/hooks/use-opportunity-types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: opp, isLoading, error } = useOpportunity(id)
  const { data: roiAnalyses = [] } = useRoiAnalysesByOpportunity(id)
  const { data: relatedContracts = [] } = useContracts(id ? { opportunityId: id } : {})
  const update = useUpdateOpportunity(id)
  const remove = useDeleteOpportunity()
  const createRoi = useCreateRoiAnalysis()

  const hasApprovedRoi = roiAnalyses.some(r => r.status === 'approved')

  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState<string>('')
  const [opportunityTypeId, setOpportunityTypeId] = useState<string>('')
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()
  const [estimatedValue, setEstimatedValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [description, setDescription] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!opp) return
    setName(opp.name || '')
    setStatusId(opp.statusId || '')
    setOpportunityTypeId(opp.opportunityTypeId || '')
    setEstimatedValue(opp.estimatedValue != null ? String(opp.estimatedValue) : '')
    setCurrency(opp.currency || 'BRL')
    setExpectedCloseDate(opp.expectedCloseDate || '')
    setDescription(opp.description || '')
    setDirty(false)
  }, [opp])

  const statusOptions = [{ value: '', label: '— sem status —' }, ...statuses.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))]
  const typeOptions = [{ value: '', label: '— sem tipo —' }, ...types.filter(t => t.active).map(t => ({ value: t.id, label: t.name }))]
  const currentStatus = statusId ? statuses.find(s => s.id === statusId) : null

  async function handleSave() {
    if (!opp) return
    try {
      await update.mutateAsync({
        name: name.trim() || opp.name,
        statusId: statusId || null,
        opportunityTypeId: opportunityTypeId || null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        currency,
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      })
      toastSaved('Oportunidade atualizada')
      setDirty(false)
    } catch (err) {
      toastError(`Erro ao salvar: ${(err as Error).message}`)
    }
  }

    const [deleteOpen, setDeleteOpen] = useState(false)
  function handleDelete() { setDeleteOpen(true) }
  async function confirmDelete(input: { reasonId: string; note: string | null }) {
    if (!opp) return
    try {
      await remove.mutateAsync({ id: opp.id, ...input })
      toastDeleted('Oportunidade excluida')
      setDeleteOpen(false)
      navigate('/opportunities')
    } catch (err) {
      toastError(`Erro ao excluir: ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
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

  if (!opp) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Oportunidade não encontrada.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/opportunities">
            <ArrowLeft className="h-4 w-4" />
            Oportunidades
          </Link>
        </Button>
      </header>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{opp.name}</h1>
          <p className="text-sm text-muted-foreground">
            ID #{opp.id} · Criada {new Date(opp.createdAt).toLocaleDateString('pt-BR')}
            {opp.wonAt && ` · Ganha em ${new Date(opp.wonAt).toLocaleDateString('pt-BR')}`}
            {opp.lostAt && ` · Perdida em ${new Date(opp.lostAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </div>

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
              value={statusId}
              onChange={(v) => { setStatusId(v); setDirty(true) }}
              options={statusOptions}
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Combobox
              value={opportunityTypeId}
              onChange={(v) => { setOpportunityTypeId(v); setDirty(true) }}
              options={typeOptions}
            />
          </div>
          <div>
            <Label htmlFor="closeDate">Fechamento previsto</Label>
            <Input
              id="closeDate"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => { setExpectedCloseDate(e.target.value); setDirty(true) }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="value">Valor estimado</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => { setEstimatedValue(e.target.value); setDirty(true) }}
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

        <div>
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDirty(true) }}
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (!opp) return
              setName(opp.name)
              setStatusId(opp.statusId || '')
    setOpportunityTypeId(opp.opportunityTypeId || '')
              setEstimatedValue(opp.estimatedValue != null ? String(opp.estimatedValue) : '')
              setCurrency(opp.currency || 'BRL')
              setExpectedCloseDate(opp.expectedCloseDate || '')
              setDescription(opp.description || '')
              setDirty(false)
            }}
            disabled={!dirty}
          >
            Descartar mudanças
          </Button>
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Análise de ROI ({roiAnalyses.length})</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Análises versionadas. ROI aprovado destrava criação de contrato.
            </p>
          </div>
          <Button
            size="sm"
            disabled={createRoi.isPending}
            onClick={async () => {
              if (!opp) return
              try {
                const r = await createRoi.mutateAsync({
                  opportunityId: opp.id,
                  name: `Análise ${new Date().toLocaleDateString('pt-BR')}`,
                })
                toastSaved(`ROI v${r.version} criado`)
                navigate(`/roi-analyses/${r.id}`)
              } catch (err) {
                toastError(`Erro: ${(err as Error).message}`)
              }
            }}
          >
            <Plus className="h-4 w-4" />Nova revisão
          </Button>
        </div>
        {roiAnalyses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma análise ainda. Clique em "Nova revisão" pra começar.
          </p>
        ) : (
          <ul className="space-y-2">
            {roiAnalyses.map(roi => (
              <li key={roi.id}>
                <Link
                  to={`/roi-analyses/${roi.id}`}
                  className="flex items-center justify-between rounded border p-3 hover:bg-muted/30"
                >
                  <div>
                    <span className="font-medium">v{roi.version}</span>
                    <span className="text-muted-foreground ml-2">— {roi.name}</span>
                    {roi.isBaseline && (
                      <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        baseline
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {roi.netValue != null && (
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrencyShort(roi.netValue, roi.currency)}
                      </span>
                    )}
                    <span className="text-muted-foreground">{ROI_STATUS_LABELS[roi.status]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Card "Contratos relacionados" — destrava após ROI aprovado.
          Permite gerar contrato com o opportunityId pré-preenchido. */}
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
              asChild
              disabled={!hasApprovedRoi && currentStatus?.category !== 'gain'}
            >
              <Link to={`/contracts/new?opportunityId=${opp.id}`}>
                <Plus className="h-4 w-4" />Gerar contrato
              </Link>
            </Button>
          </div>
          {relatedContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato gerado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedContracts.map(c => (
                <li key={c.id}>
                  <Link
                    to={`/contracts/${c.id}`}
                    className="flex items-center justify-between rounded border p-3 hover:bg-muted/30"
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {c.contractNumber}
                      </span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrencyShort(c.totalValue, c.currency)}
                      </span>
                      <span className="text-muted-foreground">{CONTRACT_STATUS_LABELS[c.status]}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <CustomFieldsCard scope="opportunity" entityType="opportunity" entityId={id} />
      <DeleteWithReasonDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} count={1} onConfirm={confirmDelete} pending={remove.isPending} />
    </div>
  )
}
