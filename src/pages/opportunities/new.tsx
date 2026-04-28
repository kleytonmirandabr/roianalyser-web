/**
 * Form de nova oportunidade — módulo isolado (Sprint 2 Batch B).
 *
 * Cria via POST /api/opportunities. Backend preenche tenantId/responsibleId
 * default a partir do user logado. Aqui só nome é obrigatório; valor, prazo
 * e descrição são opcionais.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.2.
 */

import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCreateOpportunity } from '@/features/opportunities/hooks/use-create-opportunity'
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  type OpportunityStatus,
} from '@/features/opportunities/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export function NewOpportunityPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const create = useCreateOpportunity()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<OpportunityStatus>('draft')
  const [estimatedValue, setEstimatedValue] = useState<string>('')
  const [currency, setCurrency] = useState('BRL')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [description, setDescription] = useState('')

  const statusOptions = OPPORTUNITY_STATUSES.map((s) => ({
    value: s,
    label: OPPORTUNITY_STATUS_LABELS[s],
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toastError('O nome da oportunidade é obrigatório')
      return
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        status,
        currency,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      })
      toastSaved('Oportunidade criada')
      navigate(`/opportunities/${created.id}`)
    } catch (err) {
      toastError(`Erro ao criar: ${(err as Error).message}`)
    }
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

      <div>
        <h1 className="text-2xl font-semibold">Nova oportunidade</h1>
        <p className="text-sm text-muted-foreground">
          Cliente vinculado: <strong>{user?.clientName || 'tenant atual'}</strong> ·
          Responsável: <strong>{user?.name}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-5">
          <div>
            <Label htmlFor="name">Nome da oportunidade *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: ACME — Sistema de monitoramento mina X"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status inicial</Label>
              <Combobox
                value={status}
                onChange={(v) => setStatus(v as OpportunityStatus)}
                options={statusOptions}
                placeholder="Selecione"
              />
            </div>
            <div>
              <Label htmlFor="closeDate">Fechamento previsto</Label>
              <Input
                id="closeDate"
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
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
                min="0"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="currency">Moeda</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="BRL"
                maxLength={3}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, contato principal, link da proposta..."
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button asChild variant="outline" type="button">
              <Link to="/opportunities">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : 'Criar oportunidade'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
