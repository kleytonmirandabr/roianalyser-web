/**
 * Admin /admin/workflow-rules — Master only.
 *
 * CRUD das regras de transição de status. As regras moram em
 * appState.systemRules.workflowRules e são consumidas pelo
 * TransitionGuardDialog quando alguém tenta mudar status de projeto.
 *
 * Persistência: usePatchAppState({ systemRules: { workflowRules: ... } }).
 * O patch faz merge profundo no backend, então não sobrescreve outras
 * chaves de systemRules (fiscalYearStart, branding, etc).
 */

import { Pencil, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  readAllWorkflowRules,
  type WorkflowRule,
} from '@/features/projects/lib/workflow'
import { STATUS_CATEGORIES, type StatusCategory } from '@/features/projects/lib/status-categories'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { AdminTabs } from './components/admin-tabs'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
export function AdminWorkflowRulesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appState = useAppState()
  const patch = usePatchAppState()
  const [editing, setEditing] = useState<WorkflowRule | null>(null)

  // Master only — non-master é redirecionado pra /admin (users)
  if (user && !user.isMaster) {
    return <Navigate to="/admin" replace />
  }

  /**
   * Admin precisa ver TODAS as regras (incluindo desativadas) — não dá
   * pra editar/ativar uma regra que tá invisível. O motor (`canTransitionTo`)
   * usa `readWorkflowRules` que filtra só ativas.
   */
  const rules = useMemo(
    () =>
      readAllWorkflowRules(
        (appState.data?.systemRules ?? {}) as Record<string, unknown>,
      ),
    [appState.data?.systemRules],
  )

  // Map de id → user.name pra exibir aprovadores legíveis na tabela
  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of appState.data?.users ?? []) {
      m.set(u.id, u.name || u.email || u.id)
    }
    return m
  }, [appState.data?.users])

  /**
   * Persiste a lista atualizada. Importante: lê o systemRules atual e faz
   * spread, pra não apagar outras chaves (fiscalYearStart, branding, etc)
   * que podem estar lá.
   */
  async function persistRules(next: WorkflowRule[]) {
    const currentSystemRules =
      (appState.data?.systemRules ?? {}) as Record<string, unknown>
    try {
      await patch.mutateAsync({
        systemRules: {
          ...currentSystemRules,
          workflowRules: next,
        },
      })
      toastSaved(t('admin.workflow.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function saveRule(rule: WorkflowRule) {
    const exists = rules.some((r) => r.id === rule.id)
    const next = exists
      ? rules.map((r) => (r.id === rule.id ? rule : r))
      : [...rules, rule]
    setEditing(null)
    await persistRules(next)
  }

  /**
   * Aplica regras sugeridas — starter pack de 4 regras comuns que cobrem
   * o fluxo Avaliação → Contrato → Win e tratamento de Loss. TODAS são
   * criadas com `enabled: false` (modo frouxo) — admin liga uma de cada
   * vez quando se sentir confortável. Skipa duplicatas (mesmo id).
   */
  async function applySuggestedRules() {
    const ok = await confirm({
      title: 'Aplicar regras sugeridas',
      description:
        'Vai adicionar 4 regras pré-prontas (Avaliação, Contrato, Win, Loss) com status DESATIVADO. Você ativa cada uma manualmente quando quiser. Continuar?',
      confirmLabel: 'Aplicar sugeridas',
    })
    if (!ok) return
    const existingIds = new Set(rules.map((r) => r.id))
    const toAdd = SUGGESTED_RULES.filter((r) => !existingIds.has(r.id))
    if (toAdd.length === 0) {
      toastSaved('Regras sugeridas já estão na lista.')
      return
    }
    await persistRules([...rules, ...toAdd])
  }

  async function deleteRule(rule: WorkflowRule) {
    const ok = await confirm({
      title: t('admin.workflow.deleteTitle'),
      description: t('admin.workflow.deleteDesc', { name: rule.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await persistRules(rules.filter((r) => r.id !== rule.id))
      toastDeleted(t('admin.workflow.deleted'))
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('admin.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </div>

      <AdminTabs />

      {appState.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('admin.loadError')}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('admin.workflow.subtitle', { count: rules.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={applySuggestedRules}>
            <Sparkles className="h-4 w-4" />
            <span>{t('common.fields.applySuggested')}</span>
          </Button>
          <CsvExportButton
            filename="regras-workflow"
            rows={(rules as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'active', label: 'Ativa', getValue: (r) => (r as any).active !== false },
            ]}
          />
          <Button onClick={() => setEditing(makeEmptyRule())}>
            <Plus className="h-4 w-4" />
            <span>{t('admin.workflow.new')}</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.workflow.th.name')}</TableHead>
              <TableHead>{t('admin.workflow.th.transition')}</TableHead>
              <TableHead>{t('admin.workflow.th.requires')}</TableHead>
              <TableHead>{t('admin.workflow.th.threshold')}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appState.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {t('admin.workflow.empty')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id} className={rule.enabled === false ? 'opacity-60' : undefined}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{rule.name}</span>
                      {rule.enabled === false && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Desativada
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="font-mono text-xs">
                      {rule.fromCategory ?? '*'} → {rule.toCategory}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <RequirementSummary rule={rule} userById={userById} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {rule.thresholdValue != null
                      ? `≥ ${rule.thresholdValue.toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-end gap-1">
                      <IconTooltip label={t('catalogs.detail.edit')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </IconTooltip>
                      <IconTooltip label={t('catalogs.detail.delete')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRule(rule)}
                          disabled={patch.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </IconTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="sm:max-w-xl md:max-w-2xl">
          {editing && (
            <RuleForm
              rule={editing}
              users={appState.data?.users ?? []}
              onCancel={() => setEditing(null)}
              onSave={saveRule}
              saving={patch.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function makeEmptyRule(): WorkflowRule {
  return {
    id: `rule_${Date.now()}`,
    name: '',
    toCategory: 'won',
    enabled: true,
  }
}

/**
 * Starter pack de regras pré-prontas. IDs estáveis pra evitar duplicação
 * em re-aplicações. Tudo desativado — admin liga manualmente quando
 * decidir começar a usar.
 */
const SUGGESTED_RULES: WorkflowRule[] = [
  {
    id: 'suggested_evaluation_v1',
    name: 'Avaliação exige cliente identificado',
    description:
      'Pra entrar em Avaliação (ROI), precisa ter cliente identificado e qualificação registrada.',
    toCategory: 'evaluation',
    requiresFields: ['clientName'],
    requiresChecklist: ['Lead qualificado e cliente identificado'],
    enabled: false,
  },
  {
    id: 'suggested_contract_v1',
    name: 'Contrato exige ROI aprovado',
    description:
      'Pra entrar em Contrato, ROI precisa estar aprovado pelo cliente e negociação fechada.',
    toCategory: 'contract',
    requiresChecklist: [
      'ROI aprovado pelo cliente',
      'Termos comerciais negociados e fechados',
    ],
    enabled: false,
  },
  {
    id: 'suggested_won_v1',
    name: 'Ganho exige contrato assinado',
    description:
      'Pra marcar como Ganho (Win), precisa ter contrato assinado anexado e valor confirmado.',
    toCategory: 'won',
    requiresChecklist: [
      'Contrato assinado pelas duas partes',
      'Anexo do contrato adicionado',
    ],
    requiresFields: ['totalRevenue'],
    enabled: false,
  },
  {
    id: 'suggested_lost_v1',
    name: 'Perda exige motivo registrado',
    description:
      'Pra marcar como Perda (Loss), o motivo da perda deve estar documentado.',
    toCategory: 'lost',
    requiresChecklist: ['Motivo da perda documentado'],
    requiresFields: ['lossReason'],
    enabled: false,
  },
]

function RequirementSummary({
  rule,
  userById,
}: {
  rule: WorkflowRule
  userById: Map<string, string>
}) {
  const { t } = useTranslation()
  const parts: string[] = []
  if (rule.requiresFields?.length) {
    parts.push(t('admin.workflow.requiresFieldsCount', { n: rule.requiresFields.length }))
  }
  if (rule.requiresChecklist?.length) {
    parts.push(
      t('admin.workflow.requiresChecklistCount', { n: rule.requiresChecklist.length }),
    )
  }
  if (rule.requiresApproverIds?.length) {
    const names = rule.requiresApproverIds
      .map((id) => userById.get(id) ?? id)
      .slice(0, 3)
      .join(', ')
    const extra =
      rule.requiresApproverIds.length > 3
        ? ` +${rule.requiresApproverIds.length - 3}`
        : ''
    parts.push(`${names}${extra}`)
  }
  return parts.length ? <span>{parts.join(' · ')}</span> : <span>—</span>
}

function RuleForm({
  rule,
  users,
  onCancel,
  onSave,
  saving,
}: {
  rule: WorkflowRule
  users: { id: string; name: string; email?: string; clientId?: string }[]
  onCancel: () => void
  onSave: (r: WorkflowRule) => void | Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<WorkflowRule>(rule)
  // Mantém os arrays como string separada por vírgula no input — UX simples,
  // sem precisar de chip input. Convertemos no save.
  const [fieldsText, setFieldsText] = useState(
    (rule.requiresFields ?? []).join(', '),
  )
  const [checklistText, setChecklistText] = useState(
    (rule.requiresChecklist ?? []).join('\n'),
  )

  function patch<K extends keyof WorkflowRule>(key: K, value: WorkflowRule[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function toggleApprover(userId: string) {
    setDraft((prev) => {
      const cur = new Set(prev.requiresApproverIds ?? [])
      if (cur.has(userId)) cur.delete(userId)
      else cur.add(userId)
      return { ...prev, requiresApproverIds: Array.from(cur) }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalRule: WorkflowRule = {
      ...draft,
      requiresFields: fieldsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      requiresChecklist: checklistText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    onSave(finalRule)
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {rule.name ? t('admin.workflow.editTitle') : t('admin.workflow.newTitle')}
        </SheetTitle>
      </SheetHeader>

      <SheetBody>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('admin.workflow.field.name')}*</Label>
              <Input
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                required
                placeholder={t('admin.workflow.field.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('admin.workflow.field.description')}</Label>
              <Input
                value={draft.description ?? ''}
                onChange={(e) => patch('description', e.target.value)}
                placeholder={t('admin.workflow.field.descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('admin.workflow.field.fromCategory')}</Label>
              <Combobox
                options={STATUS_CATEGORIES.map((c) => ({ value: c, label: c }))}
                value={draft.fromCategory ?? ''}
                onChange={(v) =>
                  patch('fromCategory', (v || undefined) as StatusCategory | undefined)
                }
                noneLabel={t('admin.workflow.field.fromCategoryAny')}
                placeholder={t('admin.workflow.field.fromCategory')}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('admin.workflow.field.fromCategoryHint')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('admin.workflow.field.toCategory')}*</Label>
              <Combobox
                options={STATUS_CATEGORIES.map((c) => ({ value: c, label: c }))}
                value={draft.toCategory}
                onChange={(v) => patch('toCategory', v as StatusCategory)}
                placeholder={t('admin.workflow.field.toCategory')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.workflow.field.requiresFields')}</Label>
            <Input
              value={fieldsText}
              onChange={(e) => setFieldsText(e.target.value)}
              placeholder="totalRevenue, startDate, clientName"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.workflow.field.requiresFieldsHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.workflow.field.requiresChecklist')}</Label>
            <textarea
              value={checklistText}
              onChange={(e) => setChecklistText(e.target.value)}
              placeholder={t('admin.workflow.field.requiresChecklistPlaceholder')}
              className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.workflow.field.requiresChecklistHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.workflow.field.thresholdValue')}</Label>
            <Input
              type="number"
              min={0}
              value={draft.thresholdValue ?? ''}
              onChange={(e) =>
                patch(
                  'thresholdValue',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="50000"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.workflow.field.thresholdValueHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.workflow.field.requiresApprovers')}</Label>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-input bg-background p-2 md:grid-cols-2">
              {users.length === 0 ? (
                <p className="col-span-2 px-2 py-3 text-center text-xs text-muted-foreground">
                  {t('admin.workflow.field.noUsers')}
                </p>
              ) : (
                users.map((u) => {
                  const checked = (draft.requiresApproverIds ?? []).includes(u.id)
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleApprover(u.id)}
                      />
                      <span className="truncate">{u.name || u.email}</span>
                    </label>
                  )
                })
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('admin.workflow.field.requiresApproversHint')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-enabled"
              checked={draft.enabled !== false}
              onChange={(e) => patch('enabled', e.target.checked)}
            />
            <label htmlFor="rule-enabled" className="text-sm cursor-pointer">
              {t('admin.workflow.field.enabled')}
            </label>
          </div>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving || !draft.name.trim()}>
          {saving ? t('app.loading') : t('common.submit')}
        </Button>
      </SheetFooter>
    </form>
  )
}
