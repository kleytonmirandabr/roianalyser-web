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
import { OpportunitiesListPage } from '@/pages/opportunities/list'
import { ReportsListPage } from '@/pages/reports/list'
import { CatalogsIndexPage } from '@/pages/catalogs'
import { ResetPasswordPage } from '@/pages/reset-password'

// Code-splitting: rotas pesadas são lazy. Cada `lazy(() => import(...))`
// vira um chunk próprio no build, então o usuário só baixa o que abre.
const PortfolioPage = lazy(() =>
  import('@/pages/portfolio').then((m) => ({ default: m.PortfolioPage })),
)
// NewProjectPage não é mais usado em rota (substituído por NewOpportunityPage
// + redirects /projects/new → /opportunities/new). Mantido como re-export
// histórico caso algum código externo importe — TODO: limpar quando confirmar.
const NewOpportunityPage = lazy(() =>
  import('@/pages/opportunities/new').then((m) => ({ default: m.NewOpportunityPage })),
)
const OpportunityDetailPage = lazy(() =>
  import('@/pages/opportunities/detail').then((m) => ({ default: m.OpportunityDetailPage })),
)
const OpportunitiesDashboardPage = lazy(() =>
  import('@/pages/opportunities/dashboard').then((m) => ({ default: m.OpportunitiesDashboardPage })),
)
const ContractsListPage = lazy(() =>
  import('@/pages/contracts/list').then((m) => ({ default: m.ContractsListPage })),
)
const NewContractPage = lazy(() =>
  import('@/pages/contracts/new').then((m) => ({ default: m.NewContractPage })),
)
const ContractDetailPage = lazy(() =>
  import('@/pages/contracts/detail').then((m) => ({ default: m.ContractDetailPage })),
)
const ContractsDashboardPage = lazy(() =>
  import('@/pages/contracts/dashboard').then((m) => ({ default: m.ContractsDashboardPage })),
)
const Projects2ListPage = lazy(() =>
  import('@/pages/projects2/list').then((m) => ({ default: m.Projects2ListPage })),
)
const NewProject2Page = lazy(() =>
  import('@/pages/projects2/new').then((m) => ({ default: m.NewProject2Page })),
)
const Project2DetailPage = lazy(() =>
  import('@/pages/projects2/detail').then((m) => ({ default: m.Project2DetailPage })),
)
const Projects2DashboardPage = lazy(() =>
  import('@/pages/projects2/dashboard').then((m) => ({ default: m.Projects2DashboardPage })),
)
const ForecastDetailPage = lazy(() =>
  import('@/pages/forecasts/detail').then((m) => ({ default: m.ForecastDetailPage })),
)
const ForecastsDashboardPage = lazy(() =>
  import('@/pages/forecasts/dashboard').then((m) => ({ default: m.ForecastsDashboardPage })),
)
const RoiAnalysisDetailPage = lazy(() =>
  import('@/pages/roi-analyses/detail').then((m) => ({ default: m.RoiAnalysisDetailPage })),
)
const RoiDashboardPage = lazy(() =>
  import('@/pages/roi-analyses/dashboard').then((m) => ({ default: m.RoiDashboardPage })),
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
const AdminFormFieldsPage = lazy(() =>
  import('@/pages/admin/form-fields').then((m) => ({
    default: m.AdminFormFieldsPage,
  })),
)
const AdminOpportunityStatusesPage = lazy(() =>
  import('@/pages/admin/opportunity-statuses').then((m) => ({
    default: m.AdminOpportunityStatusesPage,
  })),
)
const AdminOpportunityTypesPage = lazy(() =>
  import('@/pages/admin/opportunity-types').then((m) => ({
    default: m.AdminOpportunityTypesPage,
  })),
)
const AdminTaskTemplatesPage = lazy(() =>
  import('@/pages/admin/task-templates').then((m) => ({
    default: m.AdminTaskTemplatesPage,
  })),
)
const AdminSectorsPage = lazy(() =>
  import('@/pages/admin/sectors').then((m) => ({
    default: m.AdminSectorsPage,
  })),
)
const AdminLeadSourcesPage = lazy(() =>
  import('@/pages/admin/lead-sources').then((m) => ({
    default: m.AdminLeadSourcesPage,
  })),
)
const AdminOpportunityDeletionReasonsPage = lazy(() =>
  import('@/pages/admin/opportunity-deletion-reasons').then((m) => ({
    default: m.AdminOpportunityDeletionReasonsPage,
  })),
)
const AdminItemCategoriesPage = lazy(() =>
  import('@/pages/admin/item-categories').then((m) => ({
    default: m.AdminItemCategoriesPage,
  })),
)
const AdminBillingUnitsPage = lazy(() =>
  import('@/pages/admin/billing-units').then((m) => ({
    default: m.AdminBillingUnitsPage,
  })),
)
const AdminUserGroupsPage = lazy(() =>
  import('@/pages/admin/user-groups').then((m) => ({
    default: m.AdminUserGroupsPage,
  })),
)
const AdminFinancialTypesPage = lazy(() =>
  import('@/pages/admin/financial-types').then((m) => ({
    default: m.AdminFinancialTypesPage,
  })),
)
const AdminCatalogItemsPage = lazy(() =>
  import('@/pages/admin/catalog-items').then((m) => ({
    default: m.AdminCatalogItemsPage,
  })),
)
const AdminCompaniesPage = lazy(() =>
  import('@/pages/admin/companies').then((m) => ({
    default: m.AdminCompaniesPage,
  })),
)
const AdminContactsPage = lazy(() =>
  import('@/pages/admin/contacts').then((m) => ({
    default: m.AdminContactsPage,
  })),
)
const AdminSalesGoalsPage = lazy(() =>
  import('@/pages/admin/sales-goals').then((m) => ({
    default: m.AdminSalesGoalsPage,
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

        {/* Oportunidades — Sprint 2 (módulo isolado pós-Phase 0).
            Lista, novo e detalhe usam /api/opportunities (entity nova).
            board/funnel/lost ainda apontam pras pages legacy de projects;
            serão migradas em Batch C. */}
        <Route
          path="/opportunities"
          element={<OpportunitiesListPage />}
        />
        <Route
          path="/opportunities/dashboard"
          element={
            <Lazy>
              <OpportunitiesDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/new"
          element={
            <Lazy>
              <NewOpportunityPage />
            </Lazy>
          }
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
              <ProjectsFunnelPage scope="opportunities" />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/lost"
          element={
            <Lazy>
              <ProjectsLostPage scope="opportunities" />
            </Lazy>
          }
        />
        <Route
          path="/opportunities/:id"
          element={
            <Lazy>
              <OpportunityDetailPage />
            </Lazy>
          }
        />

        {/* Contratos — Sprint 3 (módulo isolado pós-Phase 0).
            Consome /api/contracts2 (entity nova). /api/contracts (legacy)
            ainda alimenta ProjectsListPage scope='projects' até Sprint 6. */}
        <Route
          path="/contracts"
          element={
            <Lazy>
              <ContractsListPage />
            </Lazy>
          }
        />
        <Route
          path="/contracts/dashboard"
          element={
            <Lazy>
              <ContractsDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/contracts/new"
          element={
            <Lazy>
              <NewContractPage />
            </Lazy>
          }
        />
        <Route
          path="/contracts/:id"
          element={
            <Lazy>
              <ContractDetailPage />
            </Lazy>
          }
        />

        {/* Projetos V2 — Sprint 4 (módulo isolado pós-Phase 0).
            Path /projects evita conflito com /projects (legacy). */}
        <Route
          path="/projects"
          element={
            <Lazy>
              <Projects2ListPage />
            </Lazy>
          }
        />
        <Route
          path="/projects/dashboard"
          element={
            <Lazy>
              <Projects2DashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/projects/new"
          element={
            <Lazy>
              <NewProject2Page />
            </Lazy>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <Lazy>
              <Project2DetailPage />
            </Lazy>
          }
        />

        {/* Forecast — detalhe único + dashboard */}
        <Route
          path="/forecasts/dashboard"
          element={
            <Lazy>
              <ForecastsDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/forecasts/:id"
          element={
            <Lazy>
              <ForecastDetailPage />
            </Lazy>
          }
        />

        {/* ROI Analysis — detalhe único + dashboard */}
        <Route
          path="/roi-analyses/dashboard"
          element={
            <Lazy>
              <RoiDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/roi-analyses/:id"
          element={
            <Lazy>
              <RoiAnalysisDetailPage />
            </Lazy>
          }
        />

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
          path="/admin/form-fields"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminFormFieldsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/opportunity-statuses"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminOpportunityStatusesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/opportunity-types"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminOpportunityTypesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/task-templates"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminTaskTemplatesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/sectors"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminSectorsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/lead-sources"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminLeadSourcesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/opportunity-deletion-reasons"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminOpportunityDeletionReasonsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/item-categories"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminItemCategoriesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/billing-units"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminBillingUnitsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/user-groups"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminUserGroupsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/financial-types"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminFinancialTypesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/catalog-items"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminCatalogItemsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminCompaniesPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/contacts"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminContactsPage />
              </Lazy>
            </RequireRole>
          }
        />
        <Route
          path="/admin/sales-goals"
          element={
            <RequireRole level="master">
              <Lazy>
                <AdminSalesGoalsPage />
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
