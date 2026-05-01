/**
 * Membros do projeto (Sprint Fase 1, P.3).
 *
 * Lista quem participa, com role (Owner/Editor/Viewer). Owners podem
 * convidar/remover/mudar roles. Acesso geral também é configurado aqui.
 */
import { Crown, Plus, Shield, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import {
  PROJECT_GENERAL_ACCESS_LABELS,
  PROJECT_MEMBER_ROLE_LABELS,
  type ProjectGeneralAccess,
  type ProjectMember,
  type ProjectMemberRole,
} from '@/features/projects2/members-types'
import {
  useInviteMember,
  useProjectMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '@/features/projects2/hooks/use-project-members'
import { useUpdateProject2 } from '@/features/projects2/hooks/use-update-project'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

interface Props {
  projectId: string | undefined
  generalAccess: ProjectGeneralAccess
  canManage: boolean
}

export function MembersCard({ projectId, generalAccess, canManage }: Props) {
  const list = useProjectMembers(projectId)
  const invite = useInviteMember(projectId)
  const updateRole = useUpdateMemberRole(projectId)
  const remove = useRemoveMember(projectId)
  const updateProject = useUpdateProject2(projectId)
  const appState = useAppState()

  const users = (appState.data?.users || []) as Array<{ id: string; name?: string; email?: string }>
  const members = (list.data || []) as ProjectMember[]
  const memberUserIds = new Set(members.map(m => String(m.userId)))

  const [inviting, setInviting] = useState(false)
  const [pickedUserId, setPickedUserId] = useState('')
  const [pickedRole, setPickedRole] = useState<ProjectMemberRole>('editor')

  const userOptions = users
    .filter(u => !memberUserIds.has(String(u.id)))
    .map(u => ({ value: String(u.id), label: u.name || u.email || `User #${u.id}` }))

  const roleOptions = (Object.entries(PROJECT_MEMBER_ROLE_LABELS) as Array<[ProjectMemberRole, string]>)
    .map(([value, label]) => ({ value, label }))

  const generalOptions = (Object.entries(PROJECT_GENERAL_ACCESS_LABELS) as Array<[ProjectGeneralAccess, string]>)
    .map(([value, label]) => ({ value, label }))

  function userLabel(userId: string): { name: string; email: string } {
    const u = users.find(u => String(u.id) === String(userId))
    return { name: u?.name || `User #${userId}`, email: u?.email || '' }
  }

  async function handleInvite() {
    if (!projectId || !pickedUserId) return
    try {
      await invite.mutateAsync({ userId: pickedUserId, role: pickedRole })
      toastSaved('Membro adicionado')
      setInviting(false)
      setPickedUserId('')
      setPickedRole('editor')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleRoleChange(memberId: string, role: ProjectMemberRole) {
    try {
      await updateRole.mutateAsync({ id: memberId, role })
      toastSaved('Role atualizado')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleRemove(m: ProjectMember) {
    const u = userLabel(m.userId)
    const ok = await confirm({
      title: 'Remover membro',
      description: `Remover ${u.name} do projeto?`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(m.id)
      toastDeleted('Membro removido')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleGeneralAccessChange(v: ProjectGeneralAccess) {
    try {
      await updateProject.mutateAsync({ generalAccess: v } as any)
      toastSaved('Acesso geral atualizado')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  const ownerCount = members.filter(m => m.role === 'owner').length

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Membros e permissões
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {members.length} membro{members.length !== 1 ? 's' : ''} · {ownerCount} owner{ownerCount !== 1 ? 's' : ''}
            {!canManage && <span className="ml-2 italic">— você tem acesso de leitura</span>}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviting(v => !v)}>
            <UserPlus className="h-4 w-4" /> Convidar
          </Button>
        )}
      </div>

      {/* Acesso geral */}
      <div className="rounded-md border p-3 space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Acesso geral do projeto
        </Label>
        <Combobox
          options={generalOptions}
          value={generalAccess}
          onChange={(v) => handleGeneralAccessChange(v as ProjectGeneralAccess)}
          disabled={!canManage}
        />
      </div>

      {inviting && canManage && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Usuário</Label>
              {userOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic mt-2">
                  Todos os usuários do tenant já são membros.
                </p>
              ) : (
                <Combobox
                  options={userOptions}
                  value={pickedUserId}
                  onChange={setPickedUserId}
                  placeholder="Selecione..."
                />
              )}
            </div>
            <div>
              <Label>Role</Label>
              <Combobox
                options={roleOptions}
                value={pickedRole}
                onChange={(v) => setPickedRole(v as ProjectMemberRole)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setInviting(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!pickedUserId || invite.isPending}>
              <Plus className="h-4 w-4" /> {invite.isPending ? 'Convidando...' : 'Convidar'}
            </Button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : members.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nenhum membro convidado.</div>
      ) : (
        <ul className="space-y-2">
          {members.map(m => {
            const u = userLabel(m.userId)
            const isOwner = m.role === 'owner'
            return (
              <li key={m.id} className="rounded-md border p-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  isOwner ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                  : 'bg-muted text-foreground'
                }`}>
                  {u.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-1.5">
                    {u.name}
                    {isOwner && <Crown className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                </div>
                <div className="w-44">
                  <Combobox
                    options={roleOptions}
                    value={m.role}
                    onChange={(v) => handleRoleChange(m.id, v as ProjectMemberRole)}
                    disabled={!canManage}
                  />
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(m)} title="Remover">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
