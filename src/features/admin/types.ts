/**
 * Tipos para a área administrativa global. Os dados ficam em
 * /api/app-state (full snapshot do tenant + domínios cross-tenant
 * quando o user é master).
 */

export type GlobalUser = {
  id: string
  name: string
  email: string
  username?: string
  clientId: string
  /** Multi-tenant: clients que esse user pode acessar. Default = [clientId]. */
  clientIds?: string[]
  /** Multi-tenant: tenant atualmente selecionado pelo user. Default = clientId. */
  activeClientId?: string
  profileId?: string
  groupId?: string
  isMaster?: boolean
  active?: boolean
  defaultLanguage?: string
  mfaEnabled?: boolean
  /**
   * Timezone IANA do user (ex: 'America/Sao_Paulo'). Se setado, datas/horas
   * exibidas pra esse user usam este fuso. Senão usa fuso do client (tenant)
   * ou do navegador, nessa ordem.
   */
  timezone?: string | null
}

export type GlobalProfile = {
  id: string
  name: string
  /** Vazio = perfil global. Setado = perfil específico de um cliente. */
  clientId?: string
  /** IDs das funcionalidades habilitadas. */
  functionalityIds?: string[]
}

export type GlobalFunctionality = {
  id: string
  name: string
  category?: string
  description?: string
  /** "core", "premium", etc. Define a quais planos pertence. */
  plan?: string
}

export type AccessPlan = {
  id: string
  name: string
  description?: string
  /** IDs das funcionalidades incluídas no plano. */
  functionalityIds?: string[]
  /** Sigla curta (basic/pro/enterprise). */
  code?: string
}

export type GlobalClient = {
  id: string
  name: string
  /** Sigla do plano ativo. */
  plan?: string
  accessPlanId?: string
  logoDataUrl?: string | null
  /** Email do contato administrativo do tenant. */
  contactEmail?: string
  /**
   * Início do ano fiscal no formato MM-DD (mês-dia, sem ano). Default '01-01'.
   * Usado pelo Rolling Forecast pra calcular janelas YTD/YoY.
   */
  fiscalYearStart?: string
  /** Janela do Rolling Forecast em meses. Default 18. */
  forecastHorizonMonths?: number
  /**
   * Timezone IANA do tenant (ex: 'America/Sao_Paulo'). Quando setado,
   * datas/horas são interpretadas e exibidas nesse fuso. Default null = usa
   * o fuso do navegador.
   */
  timezone?: string | null
}

export type AppStateSnapshot = {
  users?: GlobalUser[]
  profiles?: GlobalProfile[]
  clients?: GlobalClient[]
  functionalities?: GlobalFunctionality[]
  accessPlans?: AccessPlan[]
  branding?: Record<string, unknown>
  systemRules?: Record<string, unknown>
}
