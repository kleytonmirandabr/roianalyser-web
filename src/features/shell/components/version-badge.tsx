import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

// Injetado pelo Vite em build time a partir de version.json
declare const __APP_VERSION__: string
const BUNDLE_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const POLL_MS = 5 * 60_000 // 5 min

interface VersionInfo {
  version: string
  date?: string
  description?: string
}

async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    const r = await fetch('/version.json', { cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

/**
 * Mostra a versão atual no rodapé do shell.
 * Quando o servidor tem uma versão diferente do bundle carregado,
 * exibe um banner "Nova versão disponível" com opção de recarregar.
 */
export function VersionBadge() {
  const [serverVersion, setServerVersion] = useState<VersionInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const dismissedRef = useRef<string | null>(null)

  async function check() {
    const data = await fetchVersion()
    if (!data?.version) return
    setServerVersion(data)
    // Mostrar banner se versão do servidor difere do bundle E não foi dispensado
    if (data.version !== BUNDLE_VERSION && dismissedRef.current !== data.version) {
      setShowBanner(true)
    }
  }

  useEffect(() => {
    check()
    const t = setInterval(check, POLL_MS)
    return () => clearInterval(t)
  }, [])

  function dismiss() {
    if (serverVersion) dismissedRef.current = serverVersion.version
    setShowBanner(false)
  }

  return (
    <>
      {/* Badge fixo no rodapé da sidebar */}
      {serverVersion && (
        <div className="px-3 py-2 flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-mono">v{serverVersion.version}</span>
          {serverVersion.date && <span>· {serverVersion.date}</span>}
        </div>
      )}

      {/* Banner de nova versão */}
      {showBanner && serverVersion && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-lg border bg-background shadow-lg px-4 py-3 max-w-sm text-sm">
          <RefreshCw className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Nova versão disponível — v{serverVersion.version}</p>
            {serverVersion.description && (
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                {serverVersion.description}
              </p>
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
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Dispensar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
