import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './hooks/use-auth'

type RequireAuthProps = {
  children: ReactNode
}

/**
 * Guarda de rota privada.
 * - `loading`: restaurando sessão no boot, mostra tela neutra de loading.
 * - `unauthenticated`: redireciona para /login preservando o destino original
 *   em `location.state.from` para pós-login retornar ao que o usuário tentava.
 * - `authenticated`: renderiza os filhos.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
          aria-label="Carregando"
        />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
