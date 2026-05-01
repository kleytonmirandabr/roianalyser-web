import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectAttachmentsApi } from '../attachments-api'
import type { CreateProjectAttachmentInput } from '../attachments-types'

const KEY = (projectId: string) => ['project-attachments', projectId]

export function useProjectAttachments(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? KEY(projectId) : ['project-attachments', 'none'],
    queryFn: () => projectAttachmentsApi.list(projectId as string),
    enabled: !!projectId,
  })
}

export function useUploadProjectAttachment(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectAttachmentInput) =>
      projectAttachmentsApi.create(projectId as string, input),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useDeleteProjectAttachment(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) =>
      projectAttachmentsApi.delete(projectId as string, attachmentId),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export async function fileToUploadInput(file: File): Promise<{ mime: string; dataBase64: string }> {
  const buf = await file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const idx = result.indexOf(',')
      const dataBase64 = idx >= 0 ? result.slice(idx + 1) : result
      resolve({ mime: file.type || 'application/octet-stream', dataBase64 })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob([buf], { type: file.type || 'application/octet-stream' }))
  })
}
