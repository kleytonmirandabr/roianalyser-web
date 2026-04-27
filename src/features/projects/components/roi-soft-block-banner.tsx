/**
 * Banner amarelo persistente nas abas ROI quando a oportunidade está
 * em fase de Contrato. ROI já foi aprovado; alterar agora reabre a
 * aprovação.
 *
 * Soft-block: campos continuam editáveis. Apenas avisa.
 */
import { AlertTriangle } from 'lucide-react'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  getProjectCategory,
  isRoiSoftBlocked,
} from '@/features/projects/lib/project-phase'
import type { ProjectStatus } from '@/features/projects/lib/status-categories'

export function RoiSoftBlockBanner({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
  const statuses = useCatalog('projectStatuses')
  const cat = getProjectCategory(
    project.data?.status,
    (statuses.data ?? []) as unknown as ProjectStatus[],
  )
  if (!isRoiSoftBlocked(cat)) return null
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-medium">
          ROI já aprovado — fase de Contrato
        </p>
        <p className="text-xs opacity-90">
          Alterações no Resumo / Entradas / Financeiro reabrem a aprovação
          do ROI. Só faça mudanças se houve renegociação com o cliente.
        </p>
      </div>
    </div>
  )
}
