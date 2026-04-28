import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutDashboard,
  LineChart,
  ScrollText,
  Shield,
  Tags,
  Target,
  Upload,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type NavItem = {
  /** Chave i18n em `nav.<key>` */
  i18nKey: string
  to: string
  icon: ComponentType<{ className?: string }>
  /** Marca do badge (Em breve / Beta / etc) — opcional. */
  badge?: string
  /**
   * Nível mínimo de papel pra ver esse item:
   *   - 'master': só MASTER
   *   - 'admin':  ADMIN ou MASTER
   *   - 'user' (default): qualquer um logado
   */
  requiresLevel?: 'master' | 'admin' | 'user'
  /**
   * Sub-itens que aparecem quando o item-pai está expandido. Cada filho
   * herda o `requiresLevel` do pai por padrão (pode sobrescrever).
   * Quando setado, o `to` do pai é tratado como a rota "default" do grupo
   * (clique no pai navega pra ela e expande).
   */
  children?: NavChild[]
}

export type NavChild = {
  i18nKey: string
  to: string
  badge?: string
  requiresLevel?: 'master' | 'admin' | 'user'
}

/**
 * Itens de navegação principal da sidebar.
 * `to` precisa bater com a rota declarada em `src/app/router.tsx`.
 * Conforme as fases avançam, marcamos `badge` como "soon" nas pendentes.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    i18nKey: 'dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    /**
     * Oportunidades — funil pre-Win (negotiation/evaluation/contract +
     * lost/cancelled). Engloba Lista, Kanban, Funil e Perdidas.
     */
    i18nKey: 'opportunities',
    to: '/opportunities',
    icon: Target,
    children: [
      { i18nKey: 'opportunitiesList', to: '/opportunities' },
      { i18nKey: 'opportunitiesBoard', to: '/opportunities/board' },
      { i18nKey: 'opportunitiesFunnel', to: '/opportunities/funnel' },
      { i18nKey: 'opportunitiesLost', to: '/opportunities/lost' },
    ],
  },
  {
    /**
     * Projetos — pós-Win (won/execution/invoicing/done/warranty). Por
     * enquanto só Lista. Kanban de execução + Dashboard ficam pra fases
     * futuras (precisam de volume de projetos pra fazer sentido).
     */
    i18nKey: 'projects',
    to: '/projects',
    icon: BarChart3,
    children: [
      { i18nKey: 'projectsList', to: '/projects' },
    ],
  },
  {
    i18nKey: 'portfolio',
    to: '/portfolio',
    icon: Briefcase,
  },
  {
    /**
     * Contratos — Sprint 3 (módulo isolado pós-Phase 0). Consome
     * /api/contracts2 (entity nova). Lista, novo e detalhe disponíveis.
     */
    i18nKey: 'contracts',
    to: '/contracts',
    icon: FileText,
  },
  {
    i18nKey: 'catalogs',
    to: '/catalogs',
    icon: Tags,
  },
  {
    i18nKey: 'reports',
    to: '/reports',
    icon: BarChart3,
    children: [
      { i18nKey: 'reportsList', to: '/reports' },
      { i18nKey: 'reportsScheduled', to: '/reports/scheduled' },
    ],
  },
  {
    i18nKey: 'rollingForecast',
    to: '/forecast',
    icon: LineChart,
  },
  {
    i18nKey: 'audit',
    to: '/audit',
    icon: ScrollText,
  },
  {
    i18nKey: 'imports',
    to: '/imports',
    icon: Upload,
    children: [
      { i18nKey: 'importsIndex', to: '/imports' },
      { i18nKey: 'importsCompanies', to: '/imports/companies' },
      { i18nKey: 'importsContacts', to: '/imports/contacts' },
      { i18nKey: 'importsOpportunities', to: '/imports/opportunities' },
    ],
  },
  {
    i18nKey: 'admin',
    to: '/admin',
    icon: Shield,
    requiresLevel: 'admin',
    children: [
      { i18nKey: 'adminUsers', to: '/admin', requiresLevel: 'admin' },
      { i18nKey: 'adminProfiles', to: '/admin/profiles', requiresLevel: 'admin' },
      { i18nKey: 'adminPlans', to: '/admin/plans', requiresLevel: 'master' },
      { i18nKey: 'adminFunctionalities', to: '/admin/functionalities', requiresLevel: 'master' },
      { i18nKey: 'adminClients', to: '/admin/clients', requiresLevel: 'master' },
      { i18nKey: 'adminWorkflow', to: '/admin/workflow-rules', requiresLevel: 'master' },
      { i18nKey: 'adminBranding', to: '/admin/branding', requiresLevel: 'master' },
    ],
  },
]
