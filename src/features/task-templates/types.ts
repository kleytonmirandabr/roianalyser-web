export interface TaskTemplate {
  id: string
  tenantId: string
  key: string
  name: string
  description: string | null
  defaultDurationDays: number | null
  category: string | null
  displayOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}
export interface CreateTaskTemplateInput {
  key: string; name: string; description?: string | null;
  defaultDurationDays?: number | null; category?: string | null;
  displayOrder?: number; active?: boolean; tenantId?: string;
}
export interface UpdateTaskTemplateInput {
  name?: string; description?: string | null;
  defaultDurationDays?: number | null; category?: string | null;
  displayOrder?: number; active?: boolean;
}
