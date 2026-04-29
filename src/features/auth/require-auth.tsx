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
    // Bootstrap inicial: tela neutra. Em navegações subsequentes (revalidação),
    // não bloquear — children continuam visíveis pra evitar flash branco.
    return (
      <div className="flex min-h-screen items-start justify-center bg-background pt-20">
        <div className="space-y-4 w-full max-w-2xl px-6">
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded bg-muted/60 animate-pulse" />
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="h-5 w-full rounded bg-muted/50 animate-pulse" />
            <div className="h-5 w-full rounded bg-muted/50 animate-pulse" />
            <div className="h-5 w-3/4 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
