import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireRole } from '@/features/auth/components/require-role'
import { AppShell } from '@/features/shell/app-shell'
import { DashboardPage } from '@/pages/dashboard'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { LoginPage } from '@/pages/login'
import { MfaPage } from '@/pages/mfa'
import { NotFoundPage } from '@/pages/not-found'
import { ProjectsListPage } from '@/pages/projects/list'
import { ReportsListPage } from '@/pages/reports/list'
import { CatalogsIndexPage } from '@/pages/catalogs'
import { ResetPasswordPage } from '@/pages/reset-password'

// Code-splitting: rotas pesadas são lazy. Cada `lazy(() => import(...))`
// vira um chunk próprio no build, então o usuário só baixa o que abre.
const PortfolioPage = lazy(() =>
  import('@/pages/portfolio').then((m) => ({ default: m.PortfolioPage })),
)
const NewProjectPage = lazy(() =>
  import('@/pages/projects/new').then((m) => ({ default: m.NewProjectPage })),
)
const ProjectsBoardPage = lazy(() =>
  import('@/pages/projects/board').then((m) => ({
    default: m.ProjectsBoardPage,
  })),
)
const ProjectsFunnelPage = lazy(() =>
  import('@/pages/projects/funnel').then((m) => ({
    default: m.ProjectsFunnelPage,
  })),
)
const ProjectsLostPage = lazy(() =>
  import('@/pages/projects/lost').then((m) => ({ default: m.ProjectsLostPage })),
)
const ProjectDetailPage = lazy(() =>
  import('@/pages/projects/detail').then((m) => ({
    default: m.ProjectDetailPage,
  })),
)
const ProjectInfoView = lazy(() =>
  import('@/pages/projects/views/info').then((m) => ({
    default: m.ProjectInfoView,
  })),
)
const ProjectResumoView = lazy(() =>
  import('@/pages/projects/views/resumo').then((m) => ({
    default: m.ProjectResumoView,
  })),
)
const ProjectEntradasView = lazy(() =>
  import('@/pages/projects/views/entradas').then((m) => ({
    default: m.ProjectEntradasView,
  })),
)
const ProjectFinanceiroView = lazy(() =>
  import('@/pages/projects/views/financeiro').then((m) => ({
    default: m.ProjectFinanceiroView,
  })),
)
const ProjectTasksView = lazy(() =>
  import('@/pages/projects/views/tasks').then((m) => ({
    default: m.ProjectTasksView,
  })),
)
const ProjectForecastView = lazy(() =>
  import('@/pages/projects/views/forecast').then((m) => ({
    default: m.ProjectForecastView,
  })),
)
const ProjectScheduleView = lazy(() =>
  import('@/pages/projects/views/schedule').then((m) => ({
    default: m.ProjectScheduleView,
  })),
)
const ProjectContractView = lazy(() =>
  import('@/pages/projects/views/contract').then((m) => ({
    default: m.ProjectContractView,
  })),
)
const ProjectAttachmentsView = lazy(() =>
  import('@/pages/projects/views/attachments').then((m) => ({
    default: m.ProjectAttachmentsView,
  })),
)
const ProjectHistoryView = lazy(() =>
  import('@/pages/projects/views/history').then((m) => ({
    default: m.ProjectHistoryView,
  })),
)
const ProjectCommentsView = lazy(() =>
  import('@/pages/projects/views/comments').then((m) => ({
    default: m.ProjectCommentsView,
  })),
)
const CatalogDetailPage = lazy(() =>
  import('@/pages/catalogs/detail').then((m) => ({
    default: m.CatalogDetailPage,
  })),
)
const ReportDetailPage = lazy(() =>
  import('@/pages/reports/detail').then((m) => ({
    default: m.ReportDetailPage,
  })),
)
const ScheduledReportsPage = lazy(() =>
  import('@/pages/reports/scheduled').then((m) => ({
    default: m.ScheduledReportsPage,
  })),
)
const AuditLogPage = lazy(() =>
  import('@/pages/audit-log').then((m) => ({ default: m.AuditLogPage })),
)
const DiagPage = lazy(() =>
  import('@/pages/diag').then((m) => ({ default: m.DiagPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
)
const MyAgendaPage = lazy(() =>
  import('@/pages/me').then((m) => ({ default: m.MyAgendaPage })),
)
const ForecastPage = lazy(() =>
  import('@/pages/forecast').then((m) => ({ default: m.ForecastPage })),
)
const SearchPage = lazy(() =>
  import('@/pages/search').then((m) => ({ default: m.SearchPage })),
)
const HelpPage = lazy(() =>
  import('@/pages/help').then((m) => ({ default: m.HelpPage })),
)
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/users').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminProfilesPage = lazy(() =>
  import('@/pages/admin/profiles').then((m) => ({ default: m.AdminProfilesPage })),
)
const AdminPlansPage = lazy(() =>
  import('@/pages/admin/plans').then((m) => ({ default: m.AdminPlansPage })),
)
const AdminFunctionalitiesPage = lazy(() =>
  import('@/pages/admin/functionalities').then((m) => ({
    default: m.AdminFunctionalitiesPage,
  })),
)
const AdminClientsPage = lazy(() =>
  import('@/pages/admin/clients').then((m) => ({ default: m.AdminClientsPage })),
)
const AdminWorkflowRulesPage = lazy(() =>
  import('@/pages/admin/workflow-rules').then((m) => ({
    default: m.AdminWorkflowRulesPage,
  })),
)
const AdminBrandingPage = lazy(() =>
  import('@/pages/admin/branding').then((m) => ({
    default: m.AdminBrandingPage,
  })),
)
const AdminContractFormPage = lazy(() =>
  import('@/pages/admin/contract-form').then((m) => ({
    default: m.AdminContractFormPage,
  })),
)
const ImportsIndexPage = lazy(() =>
  import('@/pages/imports').then((m) => ({ default: m.ImportsIndexPage })),
)
const ImportCompaniesPage = lazy(() =>
  import('@/pages/imports/companies').then((m) => ({
    default: m.ImportCompaniesPage,
  })),
)
const ImportContactsPage = lazy(() =>
  import('@/pages/imports/contacts').then((m) => ({
    default: m.ImportContactsPage,
  })),
)
const ImportOpportunitiesPage = lazy(() =>
  import('@/pages/imports/opportunities').then((m) => ({
    default: m.ImportOpportunitiesPage,
  })),
)

function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {t('app.loading')}
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<MfaPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Privadas — todas envolvidas pelo AppShell (sidebar + header + guard) */}
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Portfolio — vista executiva consolidada */}
        <Route
          path="/portfolio"
          element={
            <Lazy>
              <PortfolioPage />
            </Lazy>
          }
        />

        {/* Oportunidades — pré-Win (negotiation/evaluation/contract/lost/cancelled) */}
        <Route
          path="/opportunities"
          element={<ProjectsListPage scope="opportunities" />}
        />
        <Route
          path="/opportunities/board"
          element={
            <Lazy>
              <ProjectsBoardPage scope="opportunities" />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/funnel"
          element={
            <Lazy>
              <ProjectsFunnelPage />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/lost"
          element={
            <Lazy>
              <ProjectsLostPage />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/new"
          element={
            <Lazy>
              <NewProjectPage />
            </Lazy>
          }
        />

        {/* Redirects de bookmarks antigos → /opportunities/* */}
        <Route
          path="/projects/board"
          element={<Navigate to="/opportunities/board" replace />}
        />
        <Route
          path="/projects/funnel"
          element={<Navigate to="/opportunities/funnel" replace />}
        />
        <Route
          path="/projects/lost"
          element={<Navigate to="/opportunities/lost" replace />}
        />

        {/* Projetos — pós-Win (won/execution/invoicing/done/warranty) */}
        <Route path="/projects" element={<ProjectsListPage scope="projects" />} />
        <Route
          path="/projects/new"
          element={
            <Lazy>
              <NewProjectPage />
            </Lazy>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <Lazy>
              <ProjectDetailPage />
            </Lazy>
          }
        >
          <Route index element={<Navigate to="info" replace />} />
          <Route
            path="info"
            element={
              <Lazy>
                <ProjectInfoView />
              </Lazy>
            }
          />
          <Route
            path="resumo"
            element={
              <Lazy>
                <ProjectResumoView />
              </Lazy>
            }
          />
          <Route
            path="entradas"
            element={
              <Lazy>
                <ProjectEntradasView />
              </Lazy>
            }
          />
          <Route
            path="financeiro"
            element={
              <Lazy>
                <ProjectFinanceiroView />
              </Lazy>
            }
          />
          <Route
            path="tasks"
            element={
              <Lazy>
                <ProjectTasksView />
              </Lazy>
            }
          />
          <Route
            path="forecast"
            element={
              <Lazy>
                <ProjectForecastView />
              </Lazy>
            }
          />
          <Route
            path="schedule"
            element={
              <Lazy>
                <ProjectScheduleView />
              </Lazy>
            }
          />
          <Route
            path="contract"
            element={
              <Lazy>
                <ProjectContractView />
              </Lazy>
            }
          />
          <Route
            path="attachments"
            element={
              <Lazy>
                <ProjectAttachmentsView />
              </Lazy>
            }
          />
          <Route
            path="history"
            element={
              <Lazy>
                <ProjectHistoryView />
              </Lazy>
            }
          />
          <Route
            path="comments"
            element={
              <Lazy>
                <ProjectCommentsView />
              </Lazy>
            }
          />
        </Route>

        {/* Catálogos */}
        <Route path="/catalogs" element={<CatalogsIndexPage />} />
        {/* Tela especial — IMPORTANTE: precisa vir ANTES da rota dinâmica
            `/catalogs/:slug` pra ter prioridade no React Router. */}
        <Route
          path="/catalogs/contract-form"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminContractFormPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/catalogs/:slug"
          element={
            <Lazy>
              <CatalogDetailPage />
            </Lazy>
          }
        />

        {/* Relatórios */}
        <Route path="/reports" element={<ReportsListPage />} />
        <Route
          path="/reports/scheduled"
          element={
            <Lazy>
              <ScheduledReportsPage />
            </Lazy>
          }
        />
        <Route
          path="/reports/:id"
          element={
            <Lazy>
              <ReportDetailPage />
            </Lazy>
          }
        />

        {/* Auditoria */}
        <Route
          path="/audit"
          element={
            <Lazy>
              <AuditLogPage />
            </Lazy>
          }
        />

        {/* Diagnóstico oculto — rota direta para validar paridade */}
        <Route
          path="/diag/:id"
          element={
            <Lazy>
              <DiagPage />
            </Lazy>
          }
        />

        {/* Importações */}
        <Route
          path="/imports"
          element={
            <Lazy>
              <ImportsIndexPage />
            </Lazy>
          }
        />
        <Route
          path="/imports/companies"
          element={
            <Lazy>
              <ImportCompaniesPage />
            </Lazy>
          }
        />
        <Route
          path="/imports/contacts"
          element={
            <Lazy>
              <ImportContactsPage />
            </Lazy>
          }
        />
        <Route
          path="/imports/opportunities"
          element={
            <Lazy>
              <ImportOpportunitiesPage />
            </Lazy>
          }
        />

        {/* Administração global (cross-tenant). Sprint H.1 — todas as rotas
            admin agora têm guard `<RequireRole>`. Antes, qualquer user logado
            podia digitar /admin/clients direto na URL e ver/editar dados de
            todos os tenants. */}
        <Route
          path="/admin"
          element={
            <RequireRole level="admin">
              <Lazy>
                <AdminUsersPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/profiles"
          element={
            <RequireRole level="admin">
              <Lazy>
                <AdminProfilesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/plans"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminPlansPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/functionalities"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminFunctionalitiesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/clients"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminClientsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/workflow-rules"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminWorkflowRulesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/branding"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminBrandingPage />
              </Lazy>
            </RequireRole>
          }
        />

        {/* Minha agenda (dashboard pessoal) */}
        <Route
          path="/me"
          element={
            <Lazy>
              <MyAgendaPage />
            </Lazy>
          }
        />

        {/* Rolling Forecast consolidado */}
        <Route
          path="/forecast"
          element={
            <Lazy>
              <ForecastPage />
            </Lazy>
          }
        />

        {/* Busca avançada */}
        <Route
          path="/search"
          element={
            <Lazy>
              <SearchPage />
            </Lazy>
          }
        />

        {/* Central de ajuda */}
        <Route
          path="/help"
          element={
            <Lazy>
              <HelpPage />
            </Lazy>
          }
        />

        {/* Configurações do usuário */}
        <Route
          path="/settings"
          element={
            <Lazy>
              <SettingsPage />
            </Lazy>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
