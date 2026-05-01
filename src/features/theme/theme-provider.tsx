/**
 * Theme provider — light / dark / system.
 *
 * Persistência em localStorage (`theme`). Inicialmente segue prefers-color-scheme
 * do SO (modo `system`) e o usuário pode forçar light ou dark.
 *
 * Aplica/remove a classe `dark` no <html> raiz (Tailwind darkMode: 'class').
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme            // valor explícito escolhido pelo usuário
  resolvedTheme: 'light' | 'dark'  // o que efetivamente está aplicado (resolve 'system')
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* ignore */ }
  return 'system'
}

function applyHtmlClass(resolved: 'light' | 'dark') {
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  // Pra evitar flash em casos de SSR/hydration (não usamos SSR mas defensivo)
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    readStoredTheme() === 'system' ? getSystemTheme() : (readStoredTheme() as 'light' | 'dark'),
  )

  // Aplica imediatamente no mount + sempre que `theme` mudar
  useEffect(() => {
    const next = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(next)
    applyHtmlClass(next)
  }, [theme])

  // Em modo 'system', escuta mudanças do SO em tempo real
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const next = mq.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyHtmlClass(next)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
