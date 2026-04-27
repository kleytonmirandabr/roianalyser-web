import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utilitário padrão do shadcn/ui para combinar classes Tailwind.
 * Resolve conflitos de classes e concatena condicionalmente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
