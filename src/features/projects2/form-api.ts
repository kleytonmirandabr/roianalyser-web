import { api, apiRequest } from '@/shared/api/client'
import type {
  CreateFormInput, FormSubmission, ProjectForm, UpdateFormInput,
} from './form-types'

// Backend uses /api/projects/ (not /api/projects2/) for form routes
const base = (pid: string) => `/projects/${encodeURIComponent(pid)}/forms`

export const projectFormsApi = {
  list: (projectId: string) =>
    api.get<ProjectForm[]>(base(projectId)),

  create: (projectId: string, input: CreateFormInput) =>
    api.post<ProjectForm>(base(projectId), input),

  get: (projectId: string, formId: string) =>
    api.get<ProjectForm>(`${base(projectId)}/${encodeURIComponent(formId)}`),

  update: (projectId: string, formId: string, patch: UpdateFormInput) =>
    api.put<ProjectForm>(`${base(projectId)}/${encodeURIComponent(formId)}`, patch),

  remove: (projectId: string, formId: string) =>
    api.delete<void>(`${base(projectId)}/${encodeURIComponent(formId)}`),

  submissions: (projectId: string, formId: string) =>
    api.get<{ submissions: Record<string, any>[]; total: number }>(
      `${base(projectId)}/${encodeURIComponent(formId)}/submissions`
    ).then(r =>
      r.submissions.map((s): FormSubmission => ({
        id:             String(s.id),
        formId:         String(s.form_id    ?? s.formId    ?? ''),
        taskId:         s.task_id    != null ? String(s.task_id)    : (s.taskId    ?? null),
        taskTitle:      s.task_title ?? s.taskTitle    ?? null,
        taskStatus:     s.task_status ?? s.taskStatus  ?? null,
        submittedBy:    s.submitted_by     ?? s.submittedBy    ?? null,
        submittedByName: s.submitted_by_name ?? s.submittedByName ?? null,
        ipAddress:      s.ip_address  ?? s.ipAddress   ?? null,
        submittedAt:    s.submitted_at ?? s.submittedAt ?? new Date().toISOString(),
      }))
    ),
}

// Public endpoints — no auth required
export const publicFormApi = {
  /** GET /api/f/:token — returns flat form config (no wrapper) */
  get: (token: string) =>
    apiRequest<{
      id: string; title: string; description: string | null;
      layout: 'list' | 'carousel'; isPublic: boolean;
      fields: import('./form-types').FormField[];
      confirmationTitle: string | null; confirmationMessage: string | null;
    }>(`/f/${encodeURIComponent(token)}`, { anonymous: true }),

  /** POST /api/f/:token/submit — body: { values: { title, description, plannedDate, col_<id>... } } */
  submit: (token: string, values: Record<string, any>) =>
    apiRequest<{ taskId: string; message: string }>(
      `/f/${encodeURIComponent(token)}/submit`,
      { method: 'POST', body: JSON.stringify({ values }), anonymous: true }
    ),
}
