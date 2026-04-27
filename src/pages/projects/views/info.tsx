import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { z } from 'zod'

import { MultiUserSelect } from '@/features/admin/components/user-select'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { CatalogSelect } from '@/features/catalogs/components/catalog-select'
import {
  CustomFieldRenderer,
  useVisibleCustomFields,
} from '@/features/catalogs/components/custom-field-renderer'
import {
  TransitionGuardDialog,
  type TransitionGuardResult,
} from '@/features/projects/components/transition-guard-dialog'
import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import { logEvent } from '@/features/projects/lib/activity-log'
import type { ProjectStatus } from '@/features/projects/lib/status-categories'
import {
  canTransitionTo,
  categoryFor,
  makePendingApproval,
  readPendingApprovals,
  readWorkflowRules,
  type TransitionCheck,
} from '@/features/projects/lib/workflow'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

type FormValues = {
  name: string
  status?: string
  currency: string
  description?: string
  responsible?: string
  clientName?: string
}

/**
 * Lista canônica de moedas suportadas pela UI. ISO 4217 — restrito ao
 * que cobrimos hoje (LATAM + alguns globais). Tenant pode usar qualquer
 * código que o backend aceitar; aqui limitamos pra evitar typo.
 */
const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'BRL — Real brasileiro' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'PYG', label: 'PYG — Guarani paraguaio' },
  { value: 'UYU', label: 'UYU — Peso uruguaio' },
  { value: 'GBP', label: 'GBP — Libra esterlina' },
]

/**
 * Aba "Informações" do detalhe de projeto — nome, status, moeda, cliente,
 * responsável e descrição. Persiste em `project.payload` mais os campos
 * fixos do projeto (name/status/currency).
 */
export function ProjectInfoView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')
  const appState = useAppState()
  const projectStatuses = useCatalog('projectStatuses')
  const { user } = useAuth()
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [teamDirty, setTeamDirty] = useState(false)
  // Estado do dialog de bloqueio de transição. Quando setado, o submit foi
  // interceptado por uma regra de workflow.
  const [pendingTransition, setPendingTransition] = useState<{
    values: FormValues
    check: TransitionCheck
    toCategoryLabel: string
  } | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('projects.detail.info.errNameRequired')),
        status: z.string().optional(),
        currency: z
          .string()
          .min(1, t('projects.detail.info.errCurrencyRequired')),
        description: z.string().optional(),
        responsible: z.string().optional(),
        clientName: z.string().optional(),
      }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      status: '',
      currency: '',
      description: '',
      responsible: '',
      clientName: '',
    },
  })

  // Quando o projeto carrega, preenche o form com os valores reais.
  useEffect(() => {
    if (!project.data) return
    const payload = project.data.payload ?? {}
    form.reset({
      name: project.data.name ?? '',
      status: project.data.status ?? '',
      currency: project.data.currency ?? '',
      description: typeof payload.description === 'string' ? payload.description : '',
      responsible:
        typeof payload.responsible === 'string' ? payload.responsible : '',
      clientName:
        typeof payload.clientName === 'string' ? payload.clientName : '',
    })
    setTeamIds(
      Array.isArray(payload.teamIds)
        ? (payload.teamIds as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
    )
    setTeamDirty(false)
  }, [project.data, form])

  /**
   * Persiste de fato — usado tanto no caminho feliz quanto após o user
   * resolver o transition guard.
   */
  async function persist(
    values: FormValues,
    extra?: {
      newApprovals?: import('@/features/projects/lib/workflow').PendingApproval[]
      activityEvent?: Parameters<typeof logEvent>[1]
    },
  ) {
    const basePayload = (project.data?.payload ?? {}) as Record<string, unknown>
    const existingApprovals = readPendingApprovals(basePayload)
    const mergedApprovals = extra?.newApprovals
      ? [...existingApprovals, ...extra.newApprovals]
      : existingApprovals
    const nextPayload: Record<string, unknown> = {
      ...basePayload,
      description: values.description,
      responsible: values.responsible,
      clientName: values.clientName,
      pendingApprovals: mergedApprovals,
    }
    if (extra?.activityEvent) {
      nextPayload.activityLog = logEvent(basePayload, extra.activityEvent)
    }
    try {
      await update.mutateAsync({
        name: values.name,
        status: values.status,
        currency: values.currency,
        payload: nextPayload,
      })
      toastSaved(t('projects.detail.info.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function onSubmit(values: FormValues) {
    // Detecta mudança de status. Se mudou, valida regras de workflow.
    const currentStatus = project.data?.status ?? ''
    const targetStatus = values.status ?? ''
    if (targetStatus && targetStatus !== currentStatus) {
      const statuses = (projectStatuses.data ?? []) as unknown as ProjectStatus[]
      const fromCat = categoryFor(currentStatus, statuses)
      const toCat = categoryFor(targetStatus, statuses)
      if (toCat && project.data) {
        const rules = readWorkflowRules(
          (appState.data?.systemRules ?? {}) as Record<string, unknown>,
        )
        const existingApprovals = readPendingApprovals(
          (project.data.payload ?? {}) as Record<string, unknown>,
        )
        const check = canTransitionTo({
          project: project.data,
          fromCategory: fromCat,
          toCategory: toCat,
          rules,
          existingApprovals,
        })
        if (!check.ok) {
          // Guarda o submit, mostra o dialog. O user resolve checks e/ou
          // pede aprovação; commitTransition retoma o salvar.
          setPendingTransition({
            values,
            check,
            toCategoryLabel: targetStatus, // mostra o nome do status como label
          })
          return
        }
      }
    }
    await persist(values)
  }

  /**
   * Chamado pelo TransitionGuardDialog quando o user resolveu todas as
   * exigências (marcou checklist + clicou solicitar aprovação onde precisa).
   * Cria as PendingApprovals e persiste.
   */
  async function commitTransition(result: TransitionGuardResult) {
    if (!pendingTransition) return
    const { values } = pendingTransition
    const newApprovals = result.approvalRequestedFor.map((rule) =>
      makePendingApproval({
        rule,
        requestedBy: user?.id,
        requestedByName: user?.name ?? user?.email,
      }),
    )
    const activityEvent = newApprovals.length
      ? {
          type: 'approval_requested' as const,
          message: t('workflow.eventApprovalRequested', {
            count: newApprovals.length,
            status: values.status ?? '',
          }),
          actorId: user?.id,
          actorName: user?.name ?? user?.email,
        }
      : undefined
    setPendingTransition(null)
    await persist(values, { newApprovals, activityEvent })
  }

  if (!params.id) return null

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>{t('projects.detail.info.title')}</CardTitle>
        <CardDescription>
          {t('projects.detail.info.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 md:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t('projects.th.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('projects.th.status')}</FormLabel>
                  <FormControl>
                    <CatalogSelect
                      refCatalog="projectStatuses"
                      storeField="name"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('projects.th.currency')}</FormLabel>
                  <FormControl>
                    <Combobox
                      options={CURRENCY_OPTIONS}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="—"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('projects.detail.info.client')}</FormLabel>
                  <FormControl>
                    <CatalogSelect
                      refCatalog="companies"
                      storeField="name"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsible"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('projects.detail.info.responsible')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t('projects.detail.info.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending
                  ? t('projects.detail.info.saving')
                  : t('projects.detail.info.save')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    {/* Campos customizados do tenant */}
    <CustomFieldsCard projectId={params.id} />

    {/* Time alocado no projeto */}
    <TeamCard
      teamIds={teamIds}
      onChange={(ids) => {
        setTeamIds(ids)
        setTeamDirty(true)
      }}
      onSave={async () => {
        if (!project.data) return
        try {
          await update.mutateAsync({
            payload: { ...(project.data.payload ?? {}), teamIds },
          })
          toastSaved(t('projects.detail.info.savedTeam'))
          setTeamDirty(false)
        } catch (err) {
          toastError(err)
        }
      }}
      dirty={teamDirty}
      saving={update.isPending}
      users={appState.data?.users ?? []}
      clientId={
        typeof project.data?.clientId === 'string'
          ? project.data.clientId
          : undefined
      }
    />

    {/* Guard de transição — abre quando uma regra de workflow bloqueia.
        O user marca checklists, pede aprovações; ao confirmar, salva. */}
    {pendingTransition && (
      <TransitionGuardDialog
        open={!!pendingTransition}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null)
        }}
        check={pendingTransition.check}
        toCategoryLabel={pendingTransition.toCategoryLabel}
        onConfirm={commitTransition}
      />
    )}
  </div>
  )
}

function CustomFieldsCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const project = useProject(projectId)
  const update = useUpdateProject(projectId)
  const fields = useVisibleCustomFields()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const payload = (project.data?.payload ?? {}) as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const f of fields) next[f.fieldKey] = payload[f.fieldKey] ?? null
    setValues(next)
    setDirty(false)
  }, [project.data, fields])

  if (fields.length === 0) return null

  async function save() {
    if (!project.data) return
    const base = (project.data.payload ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...base }
    for (const f of fields) merged[f.fieldKey] = values[f.fieldKey] ?? null
    try {
      await update.mutateAsync({ payload: merged })
      toastSaved(t('projects.detail.info.savedCustom'))
      setDirty(false)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('projects.detail.info.customFieldsTitle')}</CardTitle>
        <CardDescription>
          {t('projects.detail.info.customFieldsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label className="text-sm font-medium">
                {f.name}
                {f.required && <span className="text-destructive"> *</span>}
              </label>
              <CustomFieldRenderer
                field={f}
                value={values[f.fieldKey]}
                onChange={(v) => {
                  setValues((prev) => ({ ...prev, [f.fieldKey]: v }))
                  setDirty(true)
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={!dirty || update.isPending} size="sm">
            {update.isPending
              ? t('projects.detail.info.saving')
              : t('projects.detail.info.saveCustom')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TeamCard({
  teamIds,
  onChange,
  onSave,
  dirty,
  saving,
  users,
  clientId,
}: {
  teamIds: string[]
  onChange: (ids: string[]) => void
  onSave: () => Promise<void> | void
  dirty: boolean
  saving: boolean
  users: { id: string; name: string; email: string; clientId?: string }[]
  clientId?: string
}) {
  const { t } = useTranslation()
  // Suprime warning de unused — `users` ainda é prop pra eventual uso
  // futuro (ex: contar/badgear). Hoje quem renderiza chips é o
  // MultiUserSelect direto, então não consultamos aqui.
  void users

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('projects.detail.info.teamTitle')}</CardTitle>
        <CardDescription>{t('projects.detail.info.teamDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chips removíveis + combobox de adicionar — o MultiUserSelect
            já renderiza ambos. NÃO duplicar com uma prévia separada
            como tinha antes (chips em cima + chips com X embaixo). */}
        <MultiUserSelect
          values={teamIds}
          onChange={onChange}
          scopeClientId={clientId}
        />
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!dirty || saving} size="sm">
            {saving
              ? t('projects.detail.info.saving')
              : t('projects.detail.info.saveTeam')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
