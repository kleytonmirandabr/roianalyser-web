import type {
  AnalyticsDataset, AnalyticsQuery, QueryResult,
  AnalyticsReport, ReportConfig,
} from './analytics-types'

const API = import.meta.env.VITE_API_URL ?? ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('authToken')
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const analyticsApi = {
  getDatasets: (projectId: string | number) =>
    apiFetch<AnalyticsDataset[]>(`/api/projects/${projectId}/analytics/datasets`),

  query: (projectId: string | number, q: AnalyticsQuery) =>
    apiFetch<QueryResult>(`/api/projects/${projectId}/analytics/query`, {
      method: 'POST',
      body: JSON.stringify(q),
    }),

  getFieldValues: (projectId: string | number, dataset: string, field: string) =>
    apiFetch<string[]>(
      `/api/projects/${projectId}/analytics/datasets/${dataset}/fields/${field}/values`
    ),

  listReports: (projectId: string | number) =>
    apiFetch<AnalyticsReport[]>(`/api/projects/${projectId}/reports`),

  createReport: (projectId: string | number, name: string, dataset: string, config: ReportConfig) =>
    apiFetch<AnalyticsReport>(`/api/projects/${projectId}/reports`, {
      method: 'POST',
      body: JSON.stringify({ name, dataset, config }),
    }),

  updateReport: (projectId: string | number, id: number, name: string, dataset: string, config: ReportConfig) =>
    apiFetch<AnalyticsReport>(`/api/projects/${projectId}/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, dataset, config }),
    }),

  deleteReport: (projectId: string | number, id: number) =>
    apiFetch<void>(`/api/projects/${projectId}/reports/${id}`, { method: 'DELETE' }),
}
