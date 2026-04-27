import {
  ChevronDown,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useBranding } from '@/features/auth/hooks/use-branding'
import { getRoleLevel } from '@/features/auth/lib/permissions'
import { useSidebarCollapsed } from '@/features/shell/hooks/use-sidebar-collapsed'
import {
  NAV_ITEMS,
  type NavChild,
  type NavItem,
} from '@/features/shell/nav-config'
import { cn } from '@/shared/lib/cn'

/**
 * Sidebar com nav principal + submenus expansíveis.
 *
 * Comportamento:
 *   - Cada NAV_ITEM com `children` vira um grupo expansível.
 *   - Click no header do grupo: navega pro `to` do pai (rota default) e
 *     auto-expande o grupo.
 *   - Click no chevron (sem navegar): toggle do grupo manualmente.
 *   - Quando a rota atual está dentro de um grupo, ele auto-expande.
 *   - Modo colapsado (w-16): mostra só ícones; click ainda navega.
 */
export function Sidebar() {
  const { t } = useTranslation()
  const branding = useBranding()
  const { user, accessibleClients, activeClientId } = useAuth()
  const appState = useAppState()
  const role = getRoleLevel(user, appState.data?.profiles ?? [])
  const { collapsed, toggle } = useSidebarCollapsed()
  const location = useLocation()

  /**
   * Marca exibida no header da sidebar:
   *   1. Se há cliente ativo COM logo cadastrado → usa o logo do cliente.
   *   2. Senão → usa o logo do software (branding global).
   *
   * Master sem cliente selecionado cai no fallback (software). User comum
   * tem clientId default no boot, então quase sempre vai ter activeClient.
   * Se o cliente existe mas não tem logoDataUrl, também cai no fallback.
   *
   * IMPORTANTE: nunca mostramos texto ao lado do logo. A imagem da marca
   * já carrega o nome — duplicar com `<span>{systemName}</span>` polui.
   */
  const activeClient = activeClientId
    ? accessibleClients.find((c) => c.id === activeClientId)
    : null
  const tenantLogo = activeClient?.logoDataUrl
  const systemLogo = branding.data?.logoDataUrl
  const displayLogo = tenantLogo ?? systemLogo
  const displayAlt =
    activeClient?.name ?? branding.data?.systemName ?? t('app.name')

  const visibleItems = NAV_ITEMS.filter((item) => canSee(item.requiresLevel, role))

  // Auto-expand do grupo da rota ativa. Mantemos um Set de groups abertos
  // que é atualizado tanto manualmente (click no chevron) quanto
  // reativamente quando a rota muda.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const item of NAV_ITEMS) {
      if (item.children && isInGroup(item, location.pathname)) {
        initial.add(item.to)
      }
    }
    return initial
  })

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      for (const item of NAV_ITEMS) {
        if (item.children && isInGroup(item, location.pathname)) {
          next.add(item.to)
        }
      }
      return next
    })
  }, [location.pathname])

  function toggleGroup(itemTo: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(itemTo)) next.delete(itemTo)
      else next.add(itemTo)
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        )}
      >
        {!collapsed && (
          <>
            {displayLogo ? (
              <img
                src={displayLogo}
                alt={displayAlt}
                className="h-9 w-auto max-w-[160px] shrink-0 object-contain"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded bg-primary/10" />
            )}
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            !collapsed && 'ml-auto',
          )}
          title={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          aria-label={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              role={role}
              collapsed={collapsed}
              expanded={openGroups.has(item.to)}
              onToggleGroup={() => toggleGroup(item.to)}
            />
          ))}
        </ul>
      </nav>

      {!collapsed && (
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          {t('shell.shortcutCollapse')}
        </div>
      )}
    </aside>
  )
}

/** Renderiza um item raiz da nav. Se tem children, vira grupo expansível. */
function NavRow({
  item,
  role,
  collapsed,
  expanded,
  onToggleGroup,
}: {
  item: NavItem
  role: ReturnType<typeof getRoleLevel>
  collapsed: boolean
  expanded: boolean
  onToggleGroup: () => void
}) {
  const { t } = useTranslation()
  const Icon = item.icon
  const isDisabled = item.badge === 'soon'
  const label = t(`nav.${item.i18nKey}`)
  const hasChildren = !!item.children?.length

  // Quando colapsada, ignora children — mostra só o ícone-pai (clique
  // navega pra rota default). Submenus em modo collapsed exigiriam popover,
  // que adiciona muita complexidade pra ganho marginal aqui.
  if (collapsed || !hasChildren) {
    return (
      <li>
        <NavLink
          to={item.to}
          end={item.to === '/dashboard'}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-md text-sm font-medium transition-colors',
              collapsed
                ? 'h-10 w-10 mx-auto justify-center'
                : 'gap-3 px-3 py-2',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              isDisabled &&
                'pointer-events-none opacity-50 hover:bg-transparent',
            )
          }
          aria-disabled={isDisabled}
          aria-label={collapsed ? label : undefined}
          onClick={isDisabled ? (e) => e.preventDefault() : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {item.badge === 'soon' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('shell.soon')}
                </span>
              )}
            </>
          )}
        </NavLink>
      </li>
    )
  }

  // Grupo expansível com children. Header é clicável: navega pra rota
  // default E expande. Chevron é clicável separadamente: só toggle.
  const visibleChildren = (item.children ?? []).filter((c) =>
    canSee(c.requiresLevel ?? item.requiresLevel, role),
  )

  return (
    <li>
      <div
        className={cn(
          'flex items-center rounded-md text-sm font-medium transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          isDisabled && 'pointer-events-none opacity-50',
        )}
      >
        <NavLink
          to={item.to}
          end={item.to === '/dashboard'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 items-center gap-3 rounded-md px-3 py-2',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
          aria-disabled={isDisabled}
          onClick={isDisabled ? (e) => e.preventDefault() : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{label}</span>
        </NavLink>
        <button
          type="button"
          onClick={onToggleGroup}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent"
          aria-expanded={expanded}
          aria-label={expanded ? t('shell.collapseGroup') : t('shell.expandGroup')}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
      {expanded && visibleChildren.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l border-border ml-4 pl-2">
          {visibleChildren.map((child) => (
            <NavChildRow key={child.to} child={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

function NavChildRow({ child }: { child: NavChild }) {
  const { t } = useTranslation()
  const isDisabled = child.badge === 'soon'
  return (
    <li>
      <NavLink
        to={child.to}
        end
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            isDisabled && 'pointer-events-none opacity-50',
          )
        }
        aria-disabled={isDisabled}
        onClick={isDisabled ? (e) => e.preventDefault() : undefined}
      >
        <span className="truncate">{t(`nav.${child.i18nKey}`)}</span>
        {child.badge === 'soon' && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('shell.soon')}
          </span>
        )}
      </NavLink>
    </li>
  )
}

/**
 * Verifica se um pathname está dentro do grupo de um item-pai.
 * Cobre tanto o `to` do pai quanto qualquer `to` dos children.
 */
function isInGroup(item: NavItem, pathname: string): boolean {
  if (pathname === item.to) return true
  if (pathname.startsWith(`${item.to}/`)) return true
  for (const child of item.children ?? []) {
    if (pathname === child.to) return true
    if (pathname.startsWith(`${child.to}/`)) return true
  }
  return false
}

/** Filtro de visibilidade por papel. */
function canSee(
  required: NavItem['requiresLevel'],
  role: ReturnType<typeof getRoleLevel>,
): boolean {
  if (!required || required === 'user') return true
  if (required === 'master') return role === 'master'
  if (required === 'admin') return role === 'master' || role === 'admin'
  return true
}
