import { toast } from 'sonner'

import { ApiError } from '@/shared/api/client'

/** Toast verde de sucesso após uma operação. */
export function toastSaved(message = 'Salvo com sucesso') {
  toast.success(message)
}

export function toastDeleted(message = 'Excluído com sucesso') {
  toast.success(message)
}

/**
 * Toast vermelho de erro. Tenta extrair uma mensagem útil de ApiError;
 * caso contrário usa fallback genérico.
 */
export function toastError(error: unknown, fallback = 'Operação falhou') {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }
    if (error.status === 403) {
      toast.error('Você não tem permissão para essa ação.')
      return
    }
    if (error.status === 429) {
      toast.error('Muitas tentativas. Aguarde um momento.')
      return
    }
    toast.error(error.message || fallback)
    return
  }
  if (error instanceof Error && error.message) {
    toast.error(error.message)
    return
  }
  toast.error(fallback)
}

export { toast }
