import { api } from '@/shared/api/client'
import type {
  CreateRoiEntryInput, CreateRoiInput, RoiAnalysis, RoiEntry, RoiMetrics,
  UpdateRoiEntryInput, UpdateRoiInput,
} from './types'

export const roiAnalysesApi = {
  list: () =>
    api.get<{ items: RoiAnalysis[] }>('/roi-analyses').then(r => r.items),

  listByOpportunity: (opportunityId: string) =>
    api.get<{ items: RoiAnalysis[] }>(`/roi-analyses?opportunityId=${encodeURIComponent(opportunityId)}`)
       .then(r => r.items),

  getById: (id: string) =>
    api.get<{ item: RoiAnalysis; entries: RoiEntry[]; metrics?: RoiMetrics }>(`/roi-analyses/${encodeURIComponent(id)}`),

  create: (input: CreateRoiInput) =>
    api.post<{ item: RoiAnalysis }>('/roi-analyses', input).then(r => r.item),

  update: (id: string, input: UpdateRoiInput) =>
    api.patch<{ item: RoiAnalysis }>(`/roi-analyses/${encodeURIComponent(id)}`, input).then(r => r.item),

  delete: (id: string) =>
    api.delete<void>(`/roi-analyses/${encodeURIComponent(id)}`),

  /* ──── Entries ──── */

  addEntry: (roiId: string, input: CreateRoiEntryInput) =>
    api.post<{ item: RoiEntry }>(`/roi-analyses/${encodeURIComponent(roiId)}/entries`, input).then(r => r.item),

  updateEntry: (entryId: string, input: UpdateRoiEntryInput) =>
    api.patch<{ item: RoiEntry }>(`/roi-analyses/entries/${encodeURIComponent(entryId)}`, input).then(r => r.item),

  deleteEntry: (entryId: string) =>
    api.delete<void>(`/roi-analyses/entries/${encodeURIComponent(entryId)}`),
}
