import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminApi } from '../api'
import type { AppStateSnapshot } from '../types'

const KEY = ['admin', 'app-state']

export function useAppState() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => adminApi.getAppState(),
    staleTime: 30_000,
  })
}

/**
 * Patch parcial. Aceita {users}, {profiles}, {clients}, {functionalities},
 * {accessPlans}, etc. Aplica optimistic update e revalida em sucesso/erro.
 */
export function usePatchAppState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<AppStateSnapshot>) =>
      adminApi.patchAppState(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<AppStateSnapshot>(KEY)
      if (prev) {
        qc.setQueryData<AppStateSnapshot>(KEY, { ...prev, ...input })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}
