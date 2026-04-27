import { Toaster as SonnerToaster } from 'sonner'

/**
 * Toaster global — é montado uma vez no AppProviders.
 *
 * Use a função `toast` exportada por `sonner` em qualquer lugar do app:
 *   import { toast } from 'sonner'
 *   toast.success('Salvo com sucesso')
 *   toast.error('Não foi possível salvar')
 *   toast.info('Carregando...')
 *
 * Configurado com tema claro/escuro herdado do CSS variables.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }}
    />
  )
}
