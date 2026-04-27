import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '../api'
import type { Project } from '../types'

type MoveInput = {
  id: string
  status: string | null
}

/**
 * Move um projeto para outro status (drag-drop no Kanban). Aplica
 * optimistic update na lista cacheada para evitar "pulo" do card. Em caso
 * de falha, volta o estado anterior.
 */
export function useMoveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: MoveInput) =>
      projectsApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['projects', 'list'] })
      const prev = qc.getQueryData<Project[]>(['projects', 'list'])
      if (prev) {
        qc.setQueryData<Project[]>(
          ['projects', 'list'],
          prev.map((p) => (p.id === id ? { ...p, status } : p)),
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['projects', 'list'], ctx.prev)
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', 'list'] })
      qc.invalidateQueries({ queryKey: ['projects', 'detail', vars.id] })
    },
  })
}
