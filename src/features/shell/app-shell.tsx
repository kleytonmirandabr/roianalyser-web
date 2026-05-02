import { Outlet } from 'react-router-dom'

import { useFaviconSync } from '@/features/auth/hooks/use-favicon'
import { RequireAuth } from '@/features/auth/require-auth'

import { Header } from './components/header'
import { Sidebar } from './components/sidebar'
import { VersionBadge } from './components/version-badge'

/**
 * Layout principal das rotas autenticadas.
 *
 * Estrutura:
 * - Sidebar fixa à esquerda (256px), com nav e logo do sistema.
 * - Header no topo com switcher de idioma e menu do usuário.
 * - Conteúdo principal em <main> via <Outlet> (rotas filhas).
 *
 * Envolto por <RequireAuth> — se não houver sessão, redireciona para /login.
 */
export function AppShell() {
  // Aplica favicon e document.title do branding do tenant. Sem efeito
  // visual quando branding ainda não carregou — só atualiza ao chegar.
  useFaviconSync()
  return (
    <RequireAuth>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 min-w-0">
            <Outlet />
          </main>
          <VersionBadge />
        </div>
      </div>
    </RequireAuth>
  )
}
