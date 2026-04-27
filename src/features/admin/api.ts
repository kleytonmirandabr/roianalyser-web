import { api } from '@/shared/api/client'

import type { AppStateSnapshot } from './types'

/**
 * O endpoint /api/app-state retorna um snapshot completo do tenant
 * (sem contratos, que vêm em /api/contracts). PATCH aceita partial por
 * domain (users, profiles, clients, functionalities, accessPlans).
 */
export const adminApi = {
  getAppState: () => api.get<AppStateSnapshot>('/app-state'),

  /**
   * Patch parcial do app-state. Envie só os domínios que mudaram.
   * Ex: patch({ users: [...newList] }) salva só users sem mexer no resto.
   */
  patchAppState: (input: Partial<AppStateSnapshot>) =>
    api.patch<AppStateSnapshot>('/app-state', input),
}
