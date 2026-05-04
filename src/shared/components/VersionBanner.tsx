import { X, RefreshCw } from 'lucide-react'

interface Props {
  version: string
  description: string
  onDismiss: () => void
}

export function VersionBanner({ version, description, onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-lg border bg-background shadow-lg px-4 py-3 max-w-sm text-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <RefreshCw className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">Nova versão disponível — v{version}</p>
        {description && (
          <p className="text-muted-foreground text-xs mt-0.5 truncate">{description}</p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          Recarregar agora
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
