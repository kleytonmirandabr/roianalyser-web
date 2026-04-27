import { useState } from 'react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

type ConfirmDialogState = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive: boolean
  resolve?: (value: boolean) => void
}

const initial: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  destructive: false,
}

let setStateRef: React.Dispatch<
  React.SetStateAction<ConfirmDialogState>
> | null = null

/**
 * Substituto programático para `window.confirm`. Exibe um Dialog elegante
 * e retorna uma Promise<boolean>.
 *
 * Exemplo:
 *   const ok = await confirm({
 *     title: 'Excluir item?',
 *     description: 'Essa ação não pode ser desfeita.',
 *     destructive: true,
 *   })
 *   if (!ok) return
 */
export function confirm(options: {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setStateRef) {
      // <ConfirmDialogProvider /> não foi montado — fallback para window.confirm
      // eslint-disable-next-line no-alert
      resolve(window.confirm(options.description ?? options.title))
      return
    }
    setStateRef({
      open: true,
      title: options.title,
      description: options.description ?? '',
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      destructive: !!options.destructive,
      resolve,
    })
  })
}

/**
 * Provider que monta o Dialog global. Tem que estar uma única vez na
 * árvore (em providers.tsx). Sem ele, `confirm()` cai no fallback.
 */
export function ConfirmDialogProvider() {
  const [state, setState] = useState<ConfirmDialogState>(initial)
  setStateRef = setState

  function close(value: boolean) {
    state.resolve?.(value)
    setState(initial)
  }

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) close(false)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {state.cancelLabel}
          </Button>
          <Button
            variant={state.destructive ? 'destructive' : 'default'}
            onClick={() => close(true)}
          >
            {state.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
