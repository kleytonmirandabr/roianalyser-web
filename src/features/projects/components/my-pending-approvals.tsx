/**
 * Widget "Aprovações pendentes" pro dashboard pessoal (/me).
 *
 * Lista projetos onde o user atual está em `requiresApproverIds` de algum
 * pendingApproval ainda não respondido. Mostra: nome do projeto, quem pediu,
 * categoria de destino, valor (se threshold disparou) — e botões aprovar/negar.
 *
 * Comportamento de aprovação:
 * - Aprovar: chama grantApproval e atualiza payload do projeto. Se todos
 *   os approvers aprovaram, marca resolvedAt e a transição que estava
 *   esperando está implicitamente liberada (próxima vez que o user salvar
 *   o status de novo, passa).
 * - Negar: chama denyApproval com motivo opcional. A aprovação morre e
 *   a transição não acontece.
 */
import { CheckCircle2, ShieldX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import { logEvent } from '@/features/projects/lib/activity-log'
import {
  approvalsForUser,
  denyApproval,
  grantApproval,
  readPendingApprovals,
  type PendingApproval,
} from '@/features/projects/lib/workflow'
import type { Project } from '@/features/projects/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'

type ApprovalItem = {
  approval: PendingApproval
  project: Project
}

export function MyPendingApprovals() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projectsQuery = useProjects()

  /**
   * Coleta todas as approvals pendentes em todos os projetos do tenant
   * onde o user é approver. Faz isso em memória — escala bem até ~milhares
   * de projetos. Quando virar gargalo, cria endpoint /api/me/approvals.
   */
  const items: ApprovalItem[] = useMemo(() => {
    if (!user) return []
    const out: ApprovalItem[] = []
    for (const project of projectsQuery.data ?? []) {
      const approvals = readPendingApprovals(
        (project.payload ?? {}) as Record<string, unknown>,
      )
      const mine = approvalsForUser(approvals, user.id)
      for (const approval of mine) {
        out.push({ approval, project })
      }
    }
    // Mais antigos primeiro — quem pediu primeiro está esperando há mais tempo.
    out.sort((a, b) =>
      a.approval.requestedAt.localeCompare(b.approval.requestedAt),
    )
    return out
  }, [projectsQuery.data, user])

  if (projectsQuery.isLoading) {
    return null // o /me já tem loading global; evita flicker duplicado
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('workflow.myApprovals')}
        </h2>
        {projectsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t('app.error')}</AlertDescription>
          </Alert>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('workflow.myApprovalsEmpty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map(({ approval, project }) => (
              <li key={approval.id}>
                <ApprovalRow approval={approval} project={project} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ApprovalRow({
  approval,
  project,
}: {
  approval: PendingApproval
  project: Project
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const update = useUpdateProject(project.id)
  const [denying, setDenying] = useState(false)
  const [denyReason, setDenyReason] = useState('')

  const grants = approval.grants ?? {}
  const grantedCount = Object.keys(grants).length
  const totalCount = approval.approverIds.length

  /**
   * Mutação compartilhada — aprovar e negar diferem só pela função
   * aplicada ao approval.
   */
  async function applyMutation(
    mutator: (a: PendingApproval) => PendingApproval,
    eventType: 'approval_granted' | 'approval_denied',
    successMsg: string,
  ) {
    if (!user) return
    const basePayload = (project.payload ?? {}) as Record<string, unknown>
    const approvals = readPendingApprovals(basePayload)
    const updated = approvals.map((a) =>
      a.id === approval.id
        ? mutator(a)
        : a,
    )
    const event = {
      type: eventType,
      message:
        eventType === 'approval_granted'
          ? t('workflow.eventApprovalGranted', {
              approver: user.name ?? user.email ?? 'unknown',
            })
          : t('workflow.eventApprovalDenied', {
              approver: user.name ?? user.email ?? 'unknown',
            }),
      actorId: user.id,
      actorName: user.name ?? user.email,
    } as const
    try {
      await update.mutateAsync({
        payload: {
          ...basePayload,
          pendingApprovals: updated,
          activityLog: logEvent(basePayload, event),
        },
      })
      toastSaved(successMsg)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/projects/${project.id}/info`}
            className="block truncate font-medium text-foreground hover:underline"
          >
            {project.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('workflow.requestedBy', {
              name: approval.requestedByName ?? '—',
            })}{' '}
            ·{' '}
            {t('workflow.approvedBy', {
              count: grantedCount,
              total: totalCount,
            })}
          </p>
          <p className="mt-1 text-xs">
            <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              {approval.toCategory}
            </span>
          </p>
        </div>
      </div>

      {denying ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder={t('workflow.denyReasonPlaceholder')}
            className="min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDenying(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!user) return
                setDenying(false)
                await applyMutation(
                  (a) =>
                    denyApproval(
                      a,
                      { id: user.id, name: user.name ?? user.email },
                      denyReason || undefined,
                    ),
                  'approval_denied',
                  t('workflow.denied'),
                )
              }}
              disabled={update.isPending}
            >
              {t('workflow.deny')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (!user) return
              await applyMutation(
                (a) =>
                  grantApproval(a, {
                    id: user.id,
                    name: user.name ?? user.email,
                  }),
                'approval_granted',
                t('workflow.approved'),
              )
            }}
            disabled={update.isPending}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('workflow.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDenying(true)}
            disabled={update.isPending}
          >
            <ShieldX className="h-4 w-4" />
            {t('workflow.deny')}
          </Button>
        </div>
      )}
    </div>
  )
}
