/**
 * Form de novo Projeto NOVO (Sprint 4 Batch B).
 * Aceita ?contractId=N pra criar a partir de um Contrato vigente.
 */

import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCreateProject2 } from '@/features/projects2/hooks/use-create-project'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export function NewProject2Page() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const fromContractId = params.get('contractId')
  const create = useCreateProject2()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [budget, setBudget] = useState('')
  const [description, setDescription] = useState('')

  const statusOptions = PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toastError('Nome é obrigatório')
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
      return toastError('Data fim não pode ser anterior ao início')
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        status,
        contractId: fromContractId || null,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        budget: budget ? Number(budget) : null,
        currency: 'BRL',
        description: description.trim() || null,
      })
      toastSaved(`Projeto ${created.projectCode} criado`)
      navigate(`/projects/${created.id}`)
    } catch (err) {
      toastError(`Erro: ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/projects"><ArrowLeft className="h-4 w-4" />{t('projects2.title')}</Link>
        </Button>
      </header>

      <div>
        <h1 className="text-2xl font-semibold">{t('projects2.newTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          Cliente: <strong>{String(user?.clientName || 'tenant atual')}</strong> ·
          Manager: <strong>{String(user?.name || '')}</strong>
          {fromContractId && <> · Origem: <strong>Contrato #{fromContractId}</strong></>}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Código gerado automático: PRJ-{new Date().getFullYear()}-NNN.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-5">
          <div>
            <Label htmlFor="name">Nome do projeto *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('opportunities.initialStatus')}</Label>
              <Combobox value={status} onChange={v => setStatus(v as ProjectStatus)} options={statusOptions} />
            </div>
            <div>
              <Label htmlFor="budget">{t('common.fields.budget')}</Label>
              <Input id="budget" type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">{t('common.fields.plannedStart')}</Label>
              <Input id="start" type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end">{t('common.fields.plannedEnd')}</Label>
              <Input id="end" type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="desc">{t('common.fields.description')}</Label>
            <textarea id="desc" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button asChild variant="outline" type="button">
              <Link to="/projects">{t('common.actions.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : 'Criar projeto'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
