import * as React from 'react'

import { cn } from '@/shared/lib/cn'

/**
 * Placeholder retangular com pulso, padrão shadcn. Uso típico:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-10 w-full" />
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
