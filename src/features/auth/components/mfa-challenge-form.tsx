import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useMfaChallenge } from '../hooks/use-mfa-challenge'
import { useMfaEmailCode } from '../hooks/use-mfa-email-code'
import { ApiError } from '@/shared/api/client'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

const schema = z.object({
  code: z
    .string()
    .min(6, 'auth.twoFactor.errors.codeRequired')
    .max(16),
  rememberDevice: z.boolean(),
})

type FormValues = {
  code: string
  rememberDevice: boolean
}

type Props = {
  mfaToken: string
  mfaMethod?: string
  remember: boolean
  from?: string
}

type Mode = 'totp' | 'recovery'

export function MfaChallengeForm({ mfaToken, remember, from }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const challenge = useMfaChallenge()
  const emailCode = useMfaEmailCode()
  const [mode, setMode] = useState<Mode>('totp')
  const [emailInfo, setEmailInfo] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', rememberDevice: false },
  })

  function mapErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return t('auth.twoFactor.errors.invalidCode')
    }
    return t('auth.twoFactor.errors.unexpected')
  }

  async function onSubmit(values: FormValues) {
    try {
      await challenge.mutateAsync({
        mfaToken,
        remember,
        rememberDevice: values.rememberDevice,
        ...(mode === 'totp'
          ? { code: values.code }
          : { recoveryCode: values.code }),
      })
      navigate(from ?? '/dashboard', { replace: true })
    } catch {
      // Erro renderizado por challenge.error abaixo.
    }
  }

  async function handleSendByEmail() {
    setEmailInfo(null)
    try {
      await emailCode.mutateAsync(mfaToken)
      setEmailInfo(t('auth.twoFactor.emailSent'))
    } catch {
      setEmailInfo(t('auth.twoFactor.errors.unexpected'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {challenge.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {mapErrorMessage(challenge.error)}
            </AlertDescription>
          </Alert>
        )}

        {emailInfo && (
          <Alert>
            <AlertDescription>{emailInfo}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          {mode === 'totp'
            ? t('auth.twoFactor.subtitleTotp')
            : t('auth.twoFactor.subtitleRecovery')}
        </p>

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.twoFactor.codeLabel')}</FormLabel>
              <FormControl>
                <Input
                  inputMode={mode === 'totp' ? 'numeric' : 'text'}
                  autoComplete="one-time-code"
                  placeholder={
                    mode === 'totp' ? t('auth.twoFactor.codePlaceholder') : ''
                  }
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.code?.message
                  ? t(form.formState.errors.code.message)
                  : null}
              </FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberDevice"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <FormLabel className="cursor-pointer text-sm font-normal">
                {t('auth.twoFactor.rememberDevice')}
              </FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={challenge.isPending}>
          {challenge.isPending
            ? t('auth.twoFactor.submitting')
            : t('auth.twoFactor.submit')}
        </Button>

        <div className="flex flex-col gap-1 text-center text-sm">
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => setMode((m) => (m === 'totp' ? 'recovery' : 'totp'))}
          >
            {mode === 'totp'
              ? t('auth.twoFactor.useRecoveryCode')
              : t('auth.twoFactor.useTotpCode')}
          </button>
          {mode === 'totp' && (
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline"
              onClick={handleSendByEmail}
              disabled={emailCode.isPending}
            >
              {t('auth.twoFactor.sendByEmail')}
            </button>
          )}
        </div>
      </form>
    </Form>
  )
}
