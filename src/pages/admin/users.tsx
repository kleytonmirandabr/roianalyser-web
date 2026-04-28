import { Mail, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import type { GlobalUser } from '@/features/admin/types'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useForgotPassword } from '@/features/auth/hooks/use-forgot-password'
import { timezoneOptions } from '@/shared/lib/timezones'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import {
  DataTableActiveFilters,
  DataTableHeaderCell,
  DataTablePagination,
  useDataTable,
  type DataTableColumn,
} from '@/shared/ui/data-table'
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

export function AdminUsersPage() {
  const { t } = useTranslation()
  const appState = useAppState()
  const patch = usePatchAppState()
  const { user: currentUser } = useAuth()
  const isMasterUser = currentUser?.isMaster === true
  const [editing, setEditing] = useState<GlobalUser | null>(null)

  const allUsers = appState.data?.users ?? []
  const profiles = appState.data?.profiles ?? []
  const clients = appState.data?.clients ?? []
  const forgotPassword = useForgotPassword()

  /**
   * Reenvia o link de definição de senha pro user. Reaproveita
   * `/api/auth/forgot-password` — o template do e-mail funciona pra
   * primeira ativação E pra reset (do ponto de vista do user, ele
   * recebe o link e define a senha, em qualquer dos dois cenários).
   *
   * Próxima fase (backend lastLoginAt): usar endpoint dedicado
   * `/api/auth/resend-invite` que dispara template específico.
   */
  async function resendInvite(u: GlobalUser) {
    if (!u.email) {
      toastError(new Error('Usuário sem e-mail cadastrado.'))
      return
    }
    const ok = await confirm({
      title: 'Reenviar link de senha',
      description: `Vai enviar um e-mail pra ${u.email} com link pra definir/redefinir a senha. Confirmar?`,
      confirmLabel: 'Reenviar',
    })
    if (!ok) return
    try {
      await forgotPassword.mutateAsync(u.email)
      toastSaved('E-mail enviado.')
    } catch (err) {
      toastError(err)
    }
  }

  // Sprint H.1 — não-master vê só users do(s) próprio(s) tenant(s).
  // `activeClientId` (single) é o tenant ativo no header; `clientIds[]`
  // é a lista de tenants a que o user pertence (master tem todos).
  // Filtro client-side: garantia adicional sobre o que o backend já filtra.
  const allowedClientIds = isMasterUser
    ? null
    : new Set(
        currentUser?.clientIds && currentUser.clientIds.length > 0
          ? currentUser.clientIds
          : currentUser?.activeClientId
            ? [currentUser.activeClientId]
            : [],
      )
  const users = allowedClientIds
    ? allUsers.filter((u) => {
        // Admin/user comum NUNCA vê master users — eles são cross-tenant
        // e tipicamente sem clientId, o que antes os deixava passar pelo
        // ramo `!u.clientId` por engano. Bug visual: SODEP admin via o
        // "Administrador Master" na lista. Corrigido bloqueando explicitamente.
        if (u.isMaster) return false
        return !u.clientId || allowedClientIds.has(u.clientId)
      })
    : allUsers

  function profileLabel(id?: string) {
    if (!id) return '—'
    const p = profiles.find((x) => x.id === id)
    return p?.name ?? id
  }
  function clientLabel(id?: string) {
    if (!id) return '—'
    const c = clients.find((x) => x.id === id)
    return c?.name ?? id
  }

  // Colunas com sort + filtro multi-select. `getValue` extrai o valor cru
  // pra ordenação/filtro; `formatValue` formata o que aparece no dropdown
  // do filtro (ex: "Cliente Padrão" no lugar de "cli_xxx").
  const userColumns = useMemo<DataTableColumn<GlobalUser>[]>(
    () => [
      { key: 'name', label: t('admin.users.th.name') },
      { key: 'email', label: t('admin.users.th.email') },
      {
        key: 'clientId',
        label: t('admin.users.th.client'),
        getValue: (u) => u.clientId ?? '',
        formatValue: (v) =>
          typeof v === 'string' && v ? clientLabel(v) : '—',
      },
      {
        key: 'profileId',
        label: t('admin.users.th.profile'),
        getValue: (u) => u.profileId ?? '',
        formatValue: (v) =>
          typeof v === 'string' && v ? profileLabel(v) : '—',
      },
    ],
    [t, clients, profiles],
  )
  const dt = useDataTable(users, userColumns)

  async function saveUser(u: GlobalUser) {
    const exists = users.some((x) => x.id === u.id)
    const next = exists
      ? users.map((x) => (x.id === u.id ? u : x))
      : [...users, u]
    setEditing(null)
    try {
      await patch.mutateAsync({ users: next })
      toastSaved(t('admin.users.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function deleteUser(u: GlobalUser) {
    const ok = await confirm({
      title: t('admin.users.deleteTitle'),
      description: t('admin.users.deleteDesc', { name: u.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await patch.mutateAsync({ users: users.filter((x) => x.id !== u.id) })
      toastDeleted(t('admin.users.deleted'))
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
        <p className="text-sm text-muted-foreground">
          {t('admin.users.subtitle', { count: users.length })}
        </p>
        <Button onClick={() => setEditing(makeEmptyUser(clients[0]?.id))}>
          <Plus className="h-4 w-4" />
          <span>{t('admin.users.new')}</span>
        </Button>
      </div>

      <DataTableActiveFilters
        state={dt as never}
        columns={userColumns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {userColumns.map((col) => (
                <DataTableHeaderCell key={col.key} column={col} state={dt} />
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appState.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {appState.isSuccess && dt.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {dt.hasActiveFilters
                    ? t('admin.users.emptyFiltered')
                    : t('admin.users.empty')}
                </TableCell>
              </TableRow>
            )}
            {dt.paginatedRows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {u.name}
                    {u.isMaster && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        {t('admin.users.master')}
                      </span>
                    )}
                    {u.mfaEnabled && (
                      <IconTooltip label="Autenticação em 2 fatores ativada">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      </IconTooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {clientLabel(u.clientId)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profileLabel(u.profileId)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconTooltip label="Reenviar link de senha por e-mail">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resendInvite(u)}
                        disabled={forgotPassword.isPending || !u.email}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('catalogs.detail.edit')}>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('catalogs.detail.delete')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteUser(u)}
                        disabled={patch.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DataTablePagination state={dt} />

      {/* Sheet lateral pra editar/criar — substitui o Card inline antigo
          que aparecia embaixo da lista. Usuário continua vendo a tabela
          atrás enquanto edita. */}
      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="sm:max-w-xl md:max-w-2xl">
          {editing && (
            <UserForm
              user={editing}
              profiles={profiles}
              clients={clients}
              isMasterUser={isMasterUser}
              onCancel={() => setEditing(null)}
              onSave={saveUser}
              saving={patch.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function makeEmptyUser(defaultClientId = ''): GlobalUser {
  return {
    id: `user_${Date.now()}`,
    name: '',
    email: '',
    clientId: defaultClientId,
    clientIds: defaultClientId ? [defaultClientId] : [],
    activeClientId: defaultClientId,
    active: true,
    isMaster: false,
    defaultLanguage: 'pt',
  }
}

/**
 * Reduz uma string de telefone livre pra apenas dígitos com prefixo `+`
 * (formato canônico de armazenamento E.164). Ex: "(11) 99999-0000" →
 * "+5511999990000" (assume DDI 55 quando não informado e tem 10-11 dígitos).
 */
function normalizePhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Se já começa com 55 e tem 12-13 dígitos (DDI + DDD + número), ok.
  if (digits.length >= 12 && digits.startsWith('55')) return `+${digits}`
  // Se tem 10-11 dígitos (DDD + número, sem DDI), assume Brasil.
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  // Outros casos (DDI diferente, internacional): preserva como veio com `+`.
  return `+${digits}`
}

/**
 * Aplica máscara visual `+DDI (DDD) NNNNN-NNNN` em cima de uma string
 * normalizada (`+5511999990000`). Robusto a entradas parciais — usuário
 * digitando recebe formatação progressiva.
 */
function formatPhoneBR(stored: string | null | undefined): string {
  if (!stored) return ''
  const digits = stored.replace(/\D/g, '')
  if (!digits) return ''
  // BR: 13 dígitos completos = +55 (DD) NNNNN-NNNN
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddi = '+55'
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length <= 4) return `${ddi} (${ddd}) ${rest}`
    if (rest.length <= 8) return `${ddi} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
    // 9 dígitos (celular com 9 na frente)
    return `${ddi} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
  }
  // Sem DDI 55 — exibe livre com `+` na frente
  return `+${digits}`
}

function UserForm({
  user,
  profiles,
  clients,
  isMasterUser,
  onCancel,
  onSave,
  saving,
}: {
  user: GlobalUser
  profiles: { id: string; name: string; clientId?: string }[]
  clients: { id: string; name: string }[]
  /**
   * `true` apenas quando o user logado é Master. Controla a visibilidade dos
   * campos privilegiados:
   *   - Checkbox "Master (acesso total)"
   *   - Bloco "Clientes adicionais (multi-tenant)"
   * Backend já protege estes campos no PUT — esta prop é apenas pra UX.
   */
  isMasterUser: boolean
  onCancel: () => void
  onSave: (u: GlobalUser) => Promise<void> | void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<GlobalUser>(user)
  function patch<K extends keyof GlobalUser>(key: K, value: GlobalUser[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }
  const filteredProfiles = profiles.filter(
    (p) => !p.clientId || p.clientId === draft.clientId,
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="flex h-full flex-col"
    >
      <SheetHeader>
        <SheetTitle>
          {user.name ? t('admin.users.editTitle') : t('admin.users.newTitle')}
        </SheetTitle>
      </SheetHeader>

      <SheetBody>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.users.field.name')}*</Label>
            <Input
              value={draft.name}
              onChange={(e) => patch('name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.users.field.email')}*</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => patch('email', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              type="tel"
              value={formatPhoneBR(draft.phone ?? '')}
              onChange={(e) =>
                patch('phone', normalizePhoneBR(e.target.value) || null)
              }
              placeholder="+55 (11) 99999-0000"
              inputMode="tel"
              maxLength={20}
            />
            <p className="text-[11px] text-muted-foreground">
              DDI + DDD + número. Formato auto-aplicado.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Idioma padrão</Label>
            <Combobox
              options={[
                { value: 'pt', label: 'Português (PT)' },
                { value: 'en', label: 'English (EN)' },
                { value: 'es', label: 'Español (ES)' },
              ]}
              value={draft.defaultLanguage ?? ''}
              onChange={(v) => patch('defaultLanguage', v || undefined)}
              noneLabel="—"
              placeholder="Idioma"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.users.field.client')}*</Label>
            <Combobox
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              value={draft.clientId}
              onChange={(newClientId) => {
                setDraft((prev) => {
                  // Garante que o clientId default sempre faça parte de clientIds.
                  const list = Array.isArray(prev.clientIds) ? [...prev.clientIds] : []
                  if (newClientId && !list.includes(newClientId)) list.push(newClientId)
                  return { ...prev, clientId: newClientId, clientIds: list }
                })
              }}
              placeholder={t('admin.users.field.client')}
              required
              name="clientId"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.users.field.clientHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.users.field.profile')}</Label>
            <Combobox
              options={filteredProfiles.map((p) => ({ value: p.id, label: p.name }))}
              value={draft.profileId ?? ''}
              onChange={(v) => patch('profileId', v)}
              placeholder={t('admin.users.field.profile')}
              noneLabel="—"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.users.field.timezone')}</Label>
            <Combobox
              options={timezoneOptions()}
              value={draft.timezone ?? ''}
              onChange={(v) => patch('timezone', v || null)}
              noneLabel={t('admin.users.field.timezoneAuto')}
              placeholder={t('admin.users.field.timezone')}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.users.field.timezoneHint')}
            </p>
          </div>

          {/*
            Multi-tenant: bloco "Clientes adicionais" só aparece pra Master.
            Não-master vê só Cliente principal — o backend ignora qualquer
            tentativa de mudar clientIds vinda de não-master.
          */}
          {isMasterUser && (
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('admin.users.field.clientIds')}</Label>
              <div className="grid gap-1.5 rounded-md border border-input bg-background p-2 max-h-48 overflow-auto md:grid-cols-2">
                {clients.map((c) => {
                  const checked = (draft.clientIds ?? [draft.clientId]).includes(c.id)
                  const isPrimary = draft.clientId === c.id
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted ${isPrimary ? 'opacity-70' : ''}`}
                      title={isPrimary ? t('admin.users.field.clientIdsPrimary') : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isPrimary}
                        onChange={(e) => {
                          const list = new Set(draft.clientIds ?? [draft.clientId].filter(Boolean))
                          if (e.target.checked) list.add(c.id)
                          else list.delete(c.id)
                          patch('clientIds', Array.from(list))
                        }}
                      />
                      <span className="truncate">{c.name}</span>
                      {isPrimary && (
                        <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          {t('admin.users.field.clientIdsPrimaryBadge')}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('admin.users.field.clientIdsHint')}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft.active}
                onChange={(e) => patch('active', e.target.checked)}
              />
              {t('admin.users.field.active')}
            </label>
            {/*
              Checkbox Master só aparece pra Master. Backend ignora mudanças
              em isMaster vindas de não-master, mas mostrar o checkbox dá UX
              ruim (parece que salvou, mas backend descarta silenciosamente).
            */}
            {isMasterUser && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.isMaster}
                  onChange={(e) => patch('isMaster', e.target.checked)}
                />
                {t('admin.users.field.master')}
              </label>
            )}
          </div>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('app.loading') : t('common.submit')}
        </Button>
      </SheetFooter>
    </form>
  )
}
