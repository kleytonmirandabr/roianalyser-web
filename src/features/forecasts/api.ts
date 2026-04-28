import { api } from '@/shared/api/client'
import type {
  CreateForecastEntryInput, CreateForecastInput, Forecast, ForecastEntry,
  UpdateForecastEntryInput, UpdateForecastInput,
} from './types'

export const forecastsApi = {
  listByProject: (projectId: string) =>
    api.get<{ items: Forecast[] }>(`/forecasts?projectId=${encodeURIComponent(projectId)}`)
       .then(r => r.items),

  list: () =>
    api.get<{ items: Forecast[] }>('/forecasts').then(r => r.items),

  getById: (id: string) =>
    api.get<{ item: Forecast; entries: ForecastEntry[] }>(`/forecasts/${encodeURIComponent(id)}`),

  create: (input: CreateForecastInput) =>
    api.post<{ item: Forecast }>('/forecasts', input).then(r => r.item),

  update: (id: string, input: UpdateForecastInput) =>
    api.patch<{ item: Forecast }>(`/forecasts/${encodeURIComponent(id)}`, input).then(r => r.item),

  delete: (id: string) =>
    api.delete<void>(`/forecasts/${encodeURIComponent(id)}`),

  /* ──────── Entries ──────── */

  listEntries: (forecastId: string) =>
    api.get<{ items: ForecastEntry[] }>(`/forecasts/${encodeURIComponent(forecastId)}/entries`)
       .then(r => r.items),

  addEntry: (forecastId: string, input: CreateForecastEntryInput) =>
    api.post<{ item: ForecastEntry }>(`/forecasts/${encodeURIComponent(forecastId)}/entries`, input)
       .then(r => r.item),

  updateEntry: (entryId: string, input: UpdateForecastEntryInput) =>
    api.patch<{ item: ForecastEntry }>(`/forecasts/entries/${encodeURIComponent(entryId)}`, input)
       .then(r => r.item),

  deleteEntry: (entryId: string) =>
    api.delete<void>(`/forecasts/entries/${encodeURIComponent(entryId)}`),
}
