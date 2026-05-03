/**
 * Tipos para o Form Builder de Projetos.
 * Backend: project_forms + project_form_submissions
 */

import type { MilestoneStatus } from './milestones-types'

export type FormLayout = 'list' | 'carousel'

export interface FormField {
  /** 'title' | 'description' | 'plannedDate' | 'status' | custom column id */
  key: string
  label: string
  type: string
  required: boolean
  options?: Array<{ value: string; label: string; color?: string }>
}

export interface ProjectForm {
  id: string
  projectId: string
  title: string
  description: string | null
  token: string
  isPublic: boolean
  layout: FormLayout
  fields: FormField[]
  submitStatus: MilestoneStatus
  confirmationTitle: string | null
  confirmationMessage: string | null
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateFormInput {
  title: string
  description?: string | null
  isPublic?: boolean
  layout?: FormLayout
  fields?: FormField[]
  submitStatus?: MilestoneStatus
  confirmationTitle?: string | null
  confirmationMessage?: string | null
  isActive?: boolean
}

export type UpdateFormInput = Partial<CreateFormInput>

export interface PublicFormData {
  form: {
    id: string
    title: string
    description: string | null
    layout: FormLayout
    fields: FormField[]
    confirmationTitle: string | null
    confirmationMessage: string | null
    projectName: string
  }
}

export interface SubmitFormInput {
  title: string
  columnValues?: Record<string, any>
}

export interface FormSubmission {
  id: string
  formId: string
  taskId: string | null
  submittedBy: string | null
  ipAddress: string | null
  submittedAt: string
  taskTitle?: string | null
}
