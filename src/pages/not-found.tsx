import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-5xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground">
        Página não encontrada.
      </p>
      <Link
        to="/dashboard"
        className="text-sm font-medium text-primary hover:underline"
      >
        Voltar para o dashboard
      </Link>
    </main>
  )
}
