export type ProjectMemberRole = 'owner' | 'editor' | 'viewer'

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner (gerencia tudo)',
  editor: 'Editor (cria/edita)',
  viewer: 'Visualizador (só lê)',
}

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  role: ProjectMemberRole
  invitedBy: string | null
  invitedAt: string
  deletedAt: string | null
}

export type ProjectGeneralAccess = 'private' | 'tenant_view' | 'tenant_edit'

export const PROJECT_GENERAL_ACCESS_LABELS: Record<ProjectGeneralAccess, string> = {
  private: 'Privado — só convidados',
  tenant_view: 'Tenant pode ver — todos do SODEP veem mas não editam',
  tenant_edit: 'Tenant pode editar — todos do SODEP editam',
}
