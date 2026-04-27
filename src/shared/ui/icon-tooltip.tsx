import type { ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

type IconTooltipProps = {
  label: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * Wrap conveniente para ícones-de-ação. Mostra um tooltip com `label`
 * quando o usuário passa o mouse / foca no children.
 *
 *   <IconTooltip label="Editar">
 *     <Button variant="ghost" size="icon"><Pencil /></Button>
 *   </IconTooltip>
 */
export function IconTooltip({ label, children, side = 'top' }: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
