/**
 * Dialog mostrado quando uma transição de status é bloqueada por regras
 * de workflow.
 *
 * Comportamento:
 * - Lista os campos faltantes (sem ação direta — usuário tem que voltar
 *   pro form e preencher).
 * - Lista o checklist com checkboxes — usuário marca e clica Confirmar.
 * - Lista as exigências de aprovação — usuário clica "Solicitar aprovação"
 *   pra criar PendingApproval. A transição fica em hold até todos os
 *   approvers responderem.
 *
 * Quando todas as exigências estão atendidas (campos preenchidos +
 * checklist marcado + aprovações concedidas), o botão Confirmar fica
 * habilitado e dispara o callback onConfirm com a lista de checklist
 * confirmada e os ruleIds que ainda precisam virar PendingApproval.
 */
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  TransitionCheck,
  TransitionReason,
  WorkflowRule,
} from '@/features/projects/lib/workflow'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

export type TransitionGuardResult = {
  /** Itens de checklist marcados na sessão. */
  confirmedChecklist: Set<string>
  /** Regras pra qual o user pediu aprovação (cria PendingApproval pra cada). */
  approvalRequestedFor: WorkflowRule[]
}

export type TransitionGuardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resultado da validação inicial (antes do user marcar checklists). */
  check: TransitionCheck
  /** Categoria de destino (pra exibir título legível). */
  toCategoryLabel: string
  /** Callback quando user resolve tudo + clica Confirmar. */
  onConfirm: (result: TransitionGuardResult) => void
}

export function TransitionGuardDialog({
  open,
  onOpenChange,
  check,
  toCategoryLabel,
  onConfirm,
}: TransitionGuardDialogProps) {
  const { t } = useTranslation()
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [approvalsRequested, setApprovalsRequested] = useState<Set<string>>(
    new Set(),
  )

  // Recalcula reasons NÃO RESOLVIDAS pelos checks da sessão
  const unresolved = useMemo(() => {
    return check.reasons.filter((r) => {
      if (r.kind === 'pending_checklist') {
        return !confirmed.has(`checklist::${r.ruleName}::${r.item}`)
      }
      if (r.kind === 'requires_approval') {
        return !approvalsRequested.has(r.rule.id)
      }
      // missing_field não pode ser resolvido aqui (precisa ir pro form)
      return true
    })
  }, [check.reasons, confirmed, approvalsRequested])

  const hasMissingFields = unresolved.some((r) => r.kind === 'missing_field')
  const canConfirm = unresolved.length === 0
  const hasApprovalRequests = approvalsRequested.size > 0

  function toggleChecklist(key: string) {
    setConfirmed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function requestApproval(ruleId: string) {
    setApprovalsRequested((prev) => {
      const next = new Set(prev)
      next.add(ruleId)
      return next
    })
  }

  function handleConfirm() {
    // Mapeia checklist confirmado pra formato usado pelo canTransitionTo
    // (`${ruleId}::${item}`) — precisamos do ruleId do checklist.
    const checklistConfirmed = new Set<string>()
    for (const r of check.reasons) {
      if (r.kind === 'pending_checklist') {
        const sessionKey = `checklist::${r.ruleName}::${r.item}`
        if (confirmed.has(sessionKey)) {
          // Encontra o ruleId via applicableRules (ruleName não é único, mas aproximamos)
          const rule = check.applicableRules.find((rule) => rule.name === r.ruleName)
          if (rule) checklistConfirmed.add(`${rule.id}::${r.item}`)
        }
      }
    }
    const approvalRules = check.applicableRules.filter((r) =>
      approvalsRequested.has(r.id),
    )
    onConfirm({
      confirmedChecklist: checklistConfirmed,
      approvalRequestedFor: approvalRules,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {t('workflow.guardTitle', { category: toCategoryLabel })}
          </DialogTitle>
          <DialogDescription>
            {t('workflow.guardDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ReasonList
            reasons={check.reasons}
            confirmed={confirmed}
            approvalsRequested={approvalsRequested}
            onToggleChecklist={toggleChecklist}
            onRequestApproval={requestApproval}
          />

          {hasMissingFields && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              {t('workflow.missingFieldsHint')}
            </div>
          )}

          {hasApprovalRequests && (
            <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {t('workflow.approvalNotice', { count: approvalsRequested.size })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {hasApprovalRequests
              ? t('workflow.confirmWithApproval')
              : t('workflow.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReasonList({
  reasons,
  confirmed,
  approvalsRequested,
  onToggleChecklist,
  onRequestApproval,
}: {
  reasons: TransitionReason[]
  confirmed: Set<string>
  approvalsRequested: Set<string>
  onToggleChecklist: (key: string) => void
  onRequestApproval: (ruleId: string) => void
}) {
  const { t } = useTranslation()
  // Agrupa por regra pra UI mais clara quando há múltiplas regras ativas.
  const byRule = useMemo(() => {
    const map = new Map<string, TransitionReason[]>()
    for (const r of reasons) {
      const ruleName = 'ruleName' in r ? r.ruleName : r.rule.name
      const list = map.get(ruleName) ?? []
      list.push(r)
      map.set(ruleName, list)
    }
    return map
  }, [reasons])

  return (
    <ul className="space-y-3">
      {[...byRule.entries()].map(([ruleName, ruleReasons]) => (
        <li key={ruleName} className="rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">{ruleName}</p>
          <ul className="space-y-2 text-sm">
            {ruleReasons.map((r, i) => {
              if (r.kind === 'missing_field') {
                return (
                  <li key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t('workflow.missingField', { field: r.field })}
                    </span>
                  </li>
                )
              }
              if (r.kind === 'pending_checklist') {
                const key = `checklist::${r.ruleName}::${r.item}`
                const checked = confirmed.has(key)
                return (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleChecklist(key)}
                        className="mt-1"
                      />
                      <span className={checked ? 'text-foreground line-through opacity-70' : 'text-foreground'}>
                        {r.item}
                      </span>
                    </label>
                  </li>
                )
              }
              // requires_approval
              const requested = approvalsRequested.has(r.rule.id)
              return (
                <li key={i} className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-foreground">
                      {t('workflow.requiresApproval', {
                        approvers: r.rule.requiresApproverIds?.length ?? 0,
                      })}
                    </p>
                    {r.rule.thresholdValue != null && r.thresholdMet && (
                      <p className="text-xs text-muted-foreground">
                        {t('workflow.thresholdReason', {
                          value: r.rule.thresholdValue.toLocaleString(),
                        })}
                      </p>
                    )}
                    {requested ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('workflow.approvalRequested')}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => onRequestApproval(r.rule.id)}
                      >
                        {t('workflow.requestApproval')}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}
