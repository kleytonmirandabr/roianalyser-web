/**
 * Toggle dia/noite — 3 estados: system / light / dark.
 * Cycla nessa ordem ao clicar. Ícone reflete o estado atual.
 */
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/features/theme/theme-provider'
import { Button } from '@/shared/ui/button'

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun
  const label = theme === 'system'
    ? t('theme.system', 'Sistema')
    : theme === 'dark'
      ? t('theme.dark', 'Escuro')
      : t('theme.light', 'Claro')

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={cycle}
      title={`${t('theme.title', 'Tema')}: ${label}`}
      className={className}
      aria-label={`${t('theme.title', 'Tema')}: ${label}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
