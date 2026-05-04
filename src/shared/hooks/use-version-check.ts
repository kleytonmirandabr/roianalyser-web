import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'app_seen_version'
const POLL_MS = 5 * 60 * 1000 // 5 min

interface VersionInfo {
  version: string
  date: string
  description: string
}

async function fetchServerVersion(): Promise<VersionInfo | null> {
  try {
    const r = await fetch('/api/version', { cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

export function useVersionCheck(currentVersion: string) {
  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function check() {
    const server = await fetchServerVersion()
    if (!server) return
    const seen = localStorage.getItem(STORAGE_KEY)
    // Show banner if server has a different version than what we have loaded
    if (server.version !== currentVersion && server.version !== seen) {
      setNewVersion(server)
    }
  }

  useEffect(() => {
    // First check after 30s (give page time to settle)
    const initial = setTimeout(check, 30_000)
    timerRef.current = setInterval(check, POLL_MS)
    return () => {
      clearTimeout(initial)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentVersion])

  function dismiss() {
    if (newVersion) localStorage.setItem(STORAGE_KEY, newVersion.version)
    setNewVersion(null)
  }

  return { newVersion, dismiss }
}
