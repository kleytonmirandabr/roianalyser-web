import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCreateOpportunity } from '@/features/opportunities/hooks/use-create-opportunity'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunityTypes } from '@/features/opportunity-types/hooks/use-opportunity-types'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastError, toastSaved } from '@/shared/lib/toasts'

export function NewOpportunityPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateOpportunity()
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: types = [] } = useOpportunityTypes()

  const [name, setName] = useState('')
  const [statusId, setStatusId] = useState<string>('')
  const [opportunityTypeId, setOpportunityTypeId] = useState<string>('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError(new Error('Informe o nome da oportunidade'))
    try {
      const item = await create.mutateAsync({
        name: name.trim(),
        statusId: statusId || null,
        opportunityTypeId: opportunityTypeId || null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        currency: currency.toUpperCase().slice(0, 3) || 'BRL',
        expectedCloseDate: expectedCloseDate || null,
        description: description.trim() || null,
      })
      toastSaved('Oportunidade criada')
      navigate(`/opportunities/${item.id}`)
    } catch (err) {
      toastError(err)
    }
  }

  const statusOptions = statuses.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))
  const typeOptions = types.filter(t => t.active).map(t => ({ value: t.id, label: t.name }))

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/opportunities" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" /> Oportunidades
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t('opportunities.newOpp')}</h1>
        <p className="text-sm text-muted-foreground">
          Cliente vinculado: <strong>{String(user?.clientName || 'tenant atual')}</strong> · Responsável:{' '}
          <strong>{String(user?.name || 'Você')}</strong>
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome da oportunidade *</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: ACME — Sistema de monitoramento mina X" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t('opportunities.initialStatus')}</Label>
              <Combobox
                options={[{ value: '', label: '— sem status —' }, ...statusOptions]}
                value={statusId} onChange={setStatusId}
                placeholder="Selecione…"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('common.fields.type')}</Label>
              <Combobox
                options={[{ value: '', label: '— sem tipo —' }, ...typeOptions]}
                value={opportunityTypeId} onChange={setOpportunityTypeId}
                placeholder="Selecione…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t('opportunities.expectedClosing')}</Label>
              <Input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('common.fields.currency')}</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t('common.fields.estimatedValue')}</Label>
            <Input type="number" step="0.01" value={estimatedValue}
              onChange={e => setEstimatedValue(e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-1">
            <Label>{t('common.fields.description')}</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]"
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Contexto, contato principal, link da proposta..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/opportunities')}>{t('common.actions.cancel')}</Button>
            <Button type="submit" disabled={create.isPending}>{t('opportunities.createOpp')}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
