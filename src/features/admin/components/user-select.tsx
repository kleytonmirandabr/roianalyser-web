import { useMemo } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { Combobox } from '@/shared/ui/combobox'

type UserSelectProps = {
  id?: string
  /** ID do user selecionado, ou string vazia se nenhum. */
  value: string
  onChange: (userId: string) => void
  /**
   * Filtra usuários por clientId (escopo do tenant). Se omitido, usa o
   * tenant ativo do user logado como default — proteção contra vazamento
   * cross-tenant em telas que esquecem de passar a prop. Pra explicitamente
   * mostrar todos os tenants (master only), passe `null`.
   */
  scopeClientId?: string | null
  placeholder?: string
  disabled?: boolean
  /** Se true, inclui só usuários ativos. Default true. */
  onlyActive?: boolean
}

/**
 * Select de usuário do sistema (single). Puxa lista do useAppState. Útil
 * pra alocar responsáveis em milestones, tasks, e em qualquer lugar que
 * precise de um único user.
 *
 * Se o `value` atual não está na lista (ex: user excluído), mostra opção
 * "(usuário não encontrado)" pra não sumir do form silenciosamente.
 */
export function UserSelect({
  id,
  value,
  onChange,
  scopeClientId,
  placeholder = '— selecionar usuário —',
  disabled,
  onlyActive = true,
}: UserSelectProps) {
  const appState = useAppState()
  const { user: currentUser } = useAuth()
  // Tenant isolation default: se scopeClientId não foi passado (undefined),
  // assume tenant ativo do user logado. `null` explícito = sem filtro
  // (master only). String vazia trata como undefined → default ativo.
  const effectiveScope =
    scopeClientId === null
      ? null
      : scopeClientId && scopeClientId.length > 0
        ? scopeClientId
        : currentUser?.activeClientId ?? currentUser?.clientId ?? null
  const options = useMemo(() => {
    const base = (appState.data?.users ?? [])
      .filter((u) => (onlyActive ? u.active !== false : true))
      .filter((u) => (effectiveScope ? u.clientId === effectiveScope : true))
      .map((u) => ({
        value: u.id,
        label: u.name || u.email || u.id,
        hint: u.email !== u.name ? u.email : undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    if (value && !base.some((o) => o.value === value)) {
      base.unshift({ value, label: `(usuário não encontrado: ${value})`, hint: undefined })
    }
    return base
  }, [appState.data, effectiveScope, onlyActive, value])

  return (
    <Combobox
      id={id}
      options={options}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled || appState.isLoading}
      placeholder={appState.isLoading ? '…' : placeholder}
      noneLabel="—"
    />
  )
}

type MultiUserSelectProps = {
  /** IDs dos usuários selecionados. */
  values: string[]
  onChange: (userIds: string[]) => void
  scopeClientId?: string | null
  disabled?: boolean
}

/**
 * Multi-select de usuários como chips removíveis. Adicionar via dropdown,
 * remover via X no chip. Útil pra teamIds, responsibleIds em tasks, etc.
 */
export function MultiUserSelect({
  values,
  onChange,
  scopeClientId,
  disabled,
}: MultiUserSelectProps) {
  const appState = useAppState()
  const { user: currentUser } = useAuth()
  // Mesma defesa em profundidade que UserSelect: undefined cai pra tenant
  // ativo do user logado, `null` = sem filtro (master).
  const effectiveScope =
    scopeClientId === null
      ? null
      : scopeClientId && scopeClientId.length > 0
        ? scopeClientId
        : currentUser?.activeClientId ?? currentUser?.clientId ?? null
  const allUsers = (appState.data?.users ?? []).filter((u) =>
    effectiveScope ? u.clientId === effectiveScope : true,
  )
  const selected = values
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
  const available = allUsers
    .filter((u) => !values.includes(u.id) && u.active !== false)
    .sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    )

  function add(userId: string) {
    if (!userId || values.includes(userId)) return
    onChange([...values, userId])
  }
  function remove(userId: string) {
    onChange(values.filter((id) => id !== userId))
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              <UserAvatar name={u.name || u.email} size={16} />
              <span>{u.name || u.email}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Remover ${u.name || u.email}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <Combobox
        options={available.map((u) => ({
          value: u.id,
          label: u.name || u.email,
          hint: u.email !== u.name ? u.email : undefined,
        }))}
        value=""
        onChange={(v) => add(v)}
        disabled={disabled || appState.isLoading || available.length === 0}
        placeholder={
          available.length === 0
            ? 'Sem usuários para adicionar'
            : '+ adicionar usuário…'
        }
      />
    </div>
  )
}

type UserAvatarProps = {
  name: string
  size?: number
}

/**
 * Avatar de iniciais coloridas. Cor consistente por nome via hash simples.
 */
export function UserAvatar({ name, size = 24 }: UserAvatarProps) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [name])

  // Hash simples: soma char codes mod 360 → matiz HSL
  const hue = useMemo(() => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 31) % 360
    return h
  }, [name])

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        backgroundColor: `hsl(${hue}, 60%, 45%)`,
        width: size,
        height: size,
        fontSize: size * 0.42,
      }}
      title={name}
    >
      {initials}
    </span>
  )
}
