/**
 * Input de senha com botão de mostrar/esconder embutido.
 *
 * Por que não estender o `<Input>` base com prop `revealable`: queremos
 * a fronteira clara — `<Input type="password">` cru ainda existe pra
 * casos onde o reveal não faz sentido (campo travado, senha já
 * confirmada, etc). Pra fluxos de cadastro/login/troca de senha use
 * SEMPRE este componente.
 *
 * Acessibilidade:
 *   - Botão tem `aria-label` que muda entre "Mostrar senha" / "Ocultar
 *     senha" (i18n: `auth.showPassword` / `auth.hidePassword`).
 *   - Botão tem `tabIndex={-1}` pra não quebrar tab order do form
 *     (usuário não espera tabular pra um botão visual).
 *   - `aria-pressed` indica estado atual pro leitor de tela.
 *
 * UX:
 *   - Padding-right reservado pro botão (32px) pra texto não passar por baixo.
 *   - Botão fica `pointer-events: none` quando o input está disabled.
 */

import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Input } from '@/shared/ui/input'

export type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, disabled, ...props }, ref) {
    const { t } = useTranslation()
    const [revealed, setRevealed] = React.useState(false)

    const label = revealed ? t('auth.hidePassword') : t('auth.showPassword')
    const Icon = revealed ? EyeOff : Eye

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={revealed ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setRevealed((v) => !v)}
          disabled={disabled}
          aria-pressed={revealed}
          aria-label={label}
          title={label}
          className={cn(
            'absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
    )
  },
)
