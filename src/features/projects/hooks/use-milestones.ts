/**
 * Hooks de milestones com fallback gracioso pro payload legado.
 *
 * Padrão: tenta `GET /api/contracts/:id/milestones`. Cai pro
 * `payload.milestones[]` do projeto em DOIS cenários:
 *
 *   1) API retorna 404 (rolling deploy em curso, endpoint não montado);
 *   2) API retorna 200 com lista vazia E o payload do projeto tem
 *      milestones legados — sinal de que a tabela foi criada mas o
 *      backfill nunca rodou (caso atual em produção pós-Onda 3.B,
 *      migration cria tabela vazia e backfill fica pra script Node).
 *
 * Sem o caso (2), projetos antigos com marcos no payload aparecem com
 * Cronograma vazio mesmo tendo dados. Ver memória
 * `project_contracts_payload_dropped` pra contexto.
 *
 * Mutações sempre falam com a API. Quando user salvar um marco novo,
 * vai pra tabela e o fallback deixa de disparar (lista deixa de ser
 * vazia). Migração efetiva é "lazy via UI".
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { ApiError, api } from '@/shared/api/client'

import { useProject } from './use-project'
import { readMilestones, type Milestone } from '../lib/milestones'

const KEY = (projectId: string) => ['projects', projectId, 'milestones']

type ListResponse = { items: Milestone[] }

export function useMilestones(projectId: string | undefined) {
  const project = useProject(projectId)
  return useQuery({
    queryKey: projectId ? KEY(projectId) : ['milestones', 'disabled'],
    enabled: !!projectId,
    queryFn: async (): Promise<Milestone[]> => {
      const legacy = readMilestones(
        project.data?.payload as Record<string, unknown> | null,
      )
      try {
        const data = await api.get<ListResponse>(
          `/contracts/${projectId}/milestones`,
        )
        const fromApi = Array.isArray(data.items) ? data.items : []
        // Fallback "lazy": se a tabela está vazia mas o payload tem
        // marcos legados, mostra os legados. Quando user salvar algo,
        // a tabela ganha rows e o fallback deixa de disparar.
        if (fromApi.length === 0 && legacy.length > 0) return legacy
        return fromApi
      } catch (err) {
        // 404 = endpoint não disponível (deploy em curso) → fallback legado.
        // Outros erros relançam pra exibir alert na UI.
        if (err instanceof ApiError && err.status === 404) {
          return legacy
        }
        throw err
      }
    },
    staleTime: 30_000,
  })
}

type CreateInput = Partial<Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>> & {
  title: string
}
type UpdateInput = Partial<
  Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'contractId'>
>

export function useCreateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInput) =>
      api.post<{ item: Milestone }>(
        `/contracts/${projectId}/milestones`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useUpdateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInput }) =>
      api.patch<{ item: Milestone }>(`/milestones/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useDeleteMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/milestones/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}
