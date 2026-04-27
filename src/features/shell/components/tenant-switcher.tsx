/**
 * Multi-tenant: dropdown no header pra trocar o cliente (tenant) ativo.
 *
 * Visibilidade:
 * - Hidden quando o user só tem 1 client acessível (sem fricção pro user comum).
 * - Master sempre vê (pode trocar entre todos os clients ativos).
 *
 * Comportamento:
 * - Persiste a escolha em localStorage via writeActiveTenant.
 * - Chama POST /api/auth/switch-tenant pra persistir no DB também
 *   (sobrevive ao logout).
 * - Limpa o cache do React Query — todas as queries refetcham com o novo
 *   header X-Active-Tenant.
 */

import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { toast, toastError } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

export function TenantSwitcher() {
  const { t } = useTranslation()
  const { accessibleClients, activeClientId, switchTenant, user } = useAuth()
  const [switching, setSwitching] = useState(false)

  // Sem opções suficientes — não mostra. Evita poluição visual pro user comum.
  if (!user || accessibleClients.length <= 1) return null

  const active = accessibleClients.find((c) => c.id === activeClientId)
  const activeName = active?.name ?? t('tenant.unselected')

  async function handleSwitch(clientId: string) {
    if (clientId === activeClientId) return
    setSwitching(true)
    try {
      await switchTenant(clientId)
      const target = accessibleClients.find((c) => c.id === clientId)
      toast.success(t('tenant.switched', { name: target?.name ?? '' }))
    } catch (e) {
      toastError(e, t('tenant.switchError'))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={switching}
          title={t('tenant.switchTitle')}
        >
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="hidden max-w-[160px] truncate md:inline">{activeName}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t('tenant.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accessibleClients.map((client) => {
          const isActive = client.id === activeClientId
          return (
            <DropdownMenuItem
              key={client.id}
              onClick={() => handleSwitch(client.id)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {client.logoDataUrl ? (
                  <img
                    src={client.logoDataUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate">{client.name}</span>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
        {user.isMaster && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('tenant.masterHint', { count: accessibleClients.length })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
