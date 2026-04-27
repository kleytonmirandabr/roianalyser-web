import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { scheduledReportsApi } from '../scheduled-api'
import type {
  CreateScheduledReportInput,
  UpdateScheduledReportInput,
} from '../scheduled-types'

const LIST_KEY = ['scheduled-reports', 'list']

export function useScheduledReports() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => scheduledReportsApi.list(),
  })
}

export function useCreateScheduledReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateScheduledReportInput) =>
      scheduledReportsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export function useUpdateScheduledReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: UpdateScheduledReportInput
    }) => scheduledReportsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export function useDeleteScheduledReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export function useSendScheduledReportNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => scheduledReportsApi.sendNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}
