import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contractAttachmentsApi } from '../attachments-api'
import type { CreateAttachmentInput } from '../attachments-types'

const KEY = (contractId: string) => ['contract-attachments', contractId]

export function useContractAttachments(contractId: string | undefined) {
  return useQuery({
    queryKey: contractId ? KEY(contractId) : ['contract-attachments', 'none'],
    queryFn: () => contractAttachmentsApi.list(contractId as string),
    enabled: !!contractId,
  })
}

export function useUploadAttachment(contractId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAttachmentInput) =>
      contractAttachmentsApi.create(contractId as string, input),
    onSuccess: () => {
      if (contractId) qc.invalidateQueries({ queryKey: KEY(contractId) })
    },
  })
}

export function useDeleteAttachment(contractId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) =>
      contractAttachmentsApi.delete(contractId as string, attachmentId),
    onSuccess: () => {
      if (contractId) qc.invalidateQueries({ queryKey: KEY(contractId) })
    },
  })
}

/** Lê um File do <input> e retorna { mime, dataBase64 } pra POST. */
export async function fileToUploadInput(file: File): Promise<{ mime: string; dataBase64: string }> {
  const buf = await file.arrayBuffer()
  // base64 via FileReader é mais robusto cross-browser que btoa para binários
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      // result vem como "data:<mime>;base64,<payload>" — pegar só o payload
      const idx = result.indexOf(',')
      const dataBase64 = idx >= 0 ? result.slice(idx + 1) : result
      resolve({ mime: file.type || 'application/octet-stream', dataBase64 })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob([buf], { type: file.type || 'application/octet-stream' }))
  })
}
