import { useQuery } from '@tanstack/react-query'

type VersionInfo = {
  version?: string
  commit?: string
  shortSha?: string
  date?: string
}

/**
 * Tenta carregar /version.json — gerado por scripts/update-version.sh em prod.
 * Se não estiver disponível, o componente não renderiza nada.
 */
export function VersionBadge() {
  const query = useQuery<VersionInfo | null>({
    queryKey: ['version'],
    queryFn: async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        if (!response.ok) return null
        return (await response.json()) as VersionInfo
      } catch {
        return null
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const data = query.data
  if (!data?.version) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="font-mono">v{data.version}</span>
      {data.shortSha && <span className="font-mono">· {data.shortSha}</span>}
      {data.date && <span>· {data.date}</span>}
    </div>
  )
}
