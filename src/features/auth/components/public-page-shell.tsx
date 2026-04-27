/**
 * Shell pra telas públicas (login / forgot / reset / mfa).
 *
 * Adiciona o LanguageSwitcher no canto superior direito sobre o
 * background neutro do app. As 4 telas públicas tinham o mesmo
 * `<main className="flex min-h-screen items-center justify-center
 * bg-background p-6">` repetido — agora compartilham este shell.
 *
 * O switcher fica visualmente flutuando (absolute), não atrapalha o
 * card centralizado e respeita o `min-h-screen` do main.
 */

import type { ReactNode } from 'react'

import { LanguageSwitcher } from '@/features/shell/components/language-switcher'

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      {children}
    </main>
  )
}
