/**
 * Detalhe de Projeto NOVO (Sprint 4 Batch B).
 * Edit inline + card "Forecasts" com revisões + soft delete.
 */

import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useCreateForecast } from '@/features/forecasts/hooks/use-create-forecast'
import { useForecastsByProject } from '@/features/forecasts/hooks/use-forecasts'
import { FORECAST_STATUS_LABELS } from '@/features/forecasts/types'
import { useDeleteProject2 } from '@/features/projects2/hooks/use-delete-project'
import { useProject2 } from '@/features/projects2/hooks/use-project'
import { useUpdateProject2 } from '@/features/projects2/hooks/use-update-project'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
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

export function Project2DetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: prj, isLoading, error } = useProject2(id)
  const { data: forecasts = [] } = useForecastsByProject(id)
  const update = useUpdateProject2(id)
  const remove = useDeleteProject2()
  const createForecast = useCreateForecast()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [progressPct, setProgressPct] = useState('0')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [description, setDescription] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!prj) return
    setName(prj.name)
    setStatus(prj.status)
    setPlannedStart(prj.plannedStart || '')
    setPlannedEnd(prj.plannedEnd || '')
    setActualStart(prj.actualStart || '')
    setActualEnd(prj.actualEnd || '')
    setProgressPct(String(prj.progressPct || 0))
    setBudget(prj.budget != null ? String(prj.budget) : '')
    setCurrency(prj.currency || 'BRL')
    setDescription(prj.description || '')
    setDirty(false)
  }, [prj])

  const statusOptions = PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))

  async function handleSave() {
    if (!prj) return
    try {
      await update.mutateAsync({
        name: name.trim() || prj.name,
        status,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        actualStart: actualStart || null,
        actualEnd: actualEnd || null,
        progressPct: Number(progressPct) || 0,
        budget: budget ? Number(budget) : null,
        currency,
        description: description.trim() || null,
      })
      toastSaved('Projeto atualizado')
      setDirty(false)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete() {
    if (!prj) return
    const ok = await confirm({
      title: 'Excluir projeto?',
      description: `${prj.projectCode} — ${prj.name} será excluído.`,
      confirmLabel: 'Excluir', destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(prj.id)
      toastDeleted('Projeto excluído')
      navigate('/projects-v2')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleNewForecast() {
    if (!prj) return
    try {
      const fc = await createForecast.mutateAsync({
        projectId: prj.id,
        name: `Revisão ${new Date().toLocaleDateString('pt-BR')}`,
      })
      toastSaved(`Forecast v${fc.version} criado`)
      navigate(`/forecasts/${fc.id}`)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  if (isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>
  if (error) return <div className="p-6"><Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert></div>
  if (!prj) return <div className="p-6"><Alert><AlertDescription>Projeto não encontrado.</AlertDescription></Alert></div>

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/projects-v2"><ArrowLeft className="h-4 w-4" />Projetos</Link>
        </Button>
      </header>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground mr-2">{prj.projectCode}</span>
            {prj.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado {new Date(prj.createdAt).toLocaleDateString('pt-BR')}
            {prj.actualStart && ` · Iniciado ${new Date(prj.actualStart).toLocaleDateString('pt-BR')}`}
            {prj.actualEnd && ` · Concluído ${new Date(prj.actualEnd).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />Excluir
        </Button>
      </div>

      {prj.contractId && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase">Contrato origem</span>
              <p className="text-sm font-medium">Contrato #{prj.contractId}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/contracts/${prj.contractId}`}><ExternalLink className="h-4 w-4" />Ver contrato</Link>
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">Informações</h2>
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} onChange={e => { setName(e.target.value); setDirty(true) }} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Combobox value={status} onChange={v => { setStatus(v as ProjectStatus); setDirty(true) }} options={statusOptions} />
          </div>
          <div>
            <Label htmlFor="prog">Progresso (%)</Label>
            <Input id="prog" type="number" min="0" max="100" value={progressPct}
              onChange={e => { setProgressPct(e.target.value); setDirty(true) }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ps">Início planejado</Label>
            <Input id="ps" type="date" value={plannedStart} onChange={e => { setPlannedStart(e.target.value); setDirty(true) }} />
          </div>
          <div>
            <Label htmlFor="pe">Fim planejado</Label>
            <Input id="pe" type="date" value={plannedEnd} onChange={e => { setPlannedEnd(e.target.value); setDirty(true) }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="as">Início real</Label>
            <Input id="as" type="date" value={actualStart} onChange={e => { setActualStart(e.target.value); setDirty(true) }} />
          </div>
          <div>
            <Label htmlFor="ae">Fim real</Label>
            <Input id="ae" type="date" value={actualEnd} onChange={e => { setActualEnd(e.target.value); setDirty(true) }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bud">Orçamento</Label>
            <Input id="bud" type="number" step="0.01" value={budget} onChange={e => { setBudget(e.target.value); setDirty(true) }} />
          </div>
          <div>
            <Label htmlFor="cur">Moeda</Label>
            <Input id="cur" value={currency} onChange={e => { setCurrency(e.target.value.toUpperCase().slice(0, 3)); setDirty(true) }} maxLength={3} />
          </div>
        </div>

        <div>
          <Label htmlFor="desc">Descrição</Label>
          <textarea id="desc" value={description} onChange={e => { setDescription(e.target.value); setDirty(true) }}
            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Forecasts ({forecasts.length})</h2>
          <Button size="sm" onClick={handleNewForecast} disabled={createForecast.isPending}>
            <Plus className="h-4 w-4" />Nova revisão
          </Button>
        </div>
        {forecasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma revisão ainda. Clique em "Nova revisão" pra começar.</p>
        ) : (
          <ul className="space-y-2">
            {forecasts.map(fc => (
              <li key={fc.id}>
                <Link to={`/forecasts/${fc.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/30">
                  <div>
                    <span className="font-medium">v{fc.version}</span>
                    <span className="text-muted-foreground ml-2">— {fc.name}</span>
                    {fc.isBaseline && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">baseline</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{FORECAST_STATUS_LABELS[fc.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomFieldsCard scope="project" entityType="project" entityId={id} />
    </div>
  )
}
