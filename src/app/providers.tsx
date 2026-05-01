import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from '@/features/auth/auth-provider'
import i18n from '@/shared/i18n'
import { ConfirmDialogProvider } from '@/shared/ui/confirm-dialog'
import { Toaster } from '@/shared/ui/toaster'
import { ThemeProvider } from '@/features/theme/theme-provider'
import { TooltipProvider } from '@/shared/ui/tooltip'

import { queryClient } from './query-client'

type AppProvidersProps = {
  children: ReactNode
}

/**
 * Base path do React Router casado com `base` do Vite. Em dev é '/'; em
 * deploy sob sub-path (ex.: /v2/) o build é feito com VITE_BASE_PATH=/v2/
 * e o Vite injeta esse valor em `import.meta.env.BASE_URL` (com trailing /).
 * O Router espera basename SEM trailing slash.
 */
const ROUTER_BASENAME =
  import.meta.env.BASE_URL.replace(/\/+$/, '') || undefined

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter
          basename={ROUTER_BASENAME}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster />
              <ConfirmDialogProvider />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
