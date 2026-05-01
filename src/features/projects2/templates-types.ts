/**
 * Templates de Projeto (Phase 2 P.5).
 * Estrutura JSONB com grupos/tarefas/subtarefas + colunas customizadas default.
 */
import type { ColumnType } from './task-columns-types'

export interface TemplateTaskNode {
  title: string
  kind: 'group' | 'task' | 'subtask'
  children?: TemplateTaskNode[]
  plannedOffsetDays?: number | null
}

export interface TemplateColumnDef {
  columnKey: string
  label: string
  type: ColumnType
  options?: any
}

export interface ProjectTemplate {
  id: string
  tenantId: string
  name: string
  description: string | null
  structure: { groups?: TemplateTaskNode[]; tasks?: TemplateTaskNode[] }
  defaultColumns: TemplateColumnDef[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  structure?: ProjectTemplate['structure']
  defaultColumns?: TemplateColumnDef[]
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>
