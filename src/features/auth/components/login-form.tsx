import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import {
  isMfaChallenge,
  isMfaSetupRequired,
  isSessionPayload,
  useLogin,
} from '../hooks/use-login'
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
import { PasswordInput } from '@/shared/ui/password-input'

const loginSchema = z.object({
  login: z.string().min(1, 'auth.login.errors.loginRequired'),
  password: z.string().min(1, 'auth.login.errors.passwordRequired'),
  rememberMe: z.boolean(),
})

type LoginFormValues = {
  login: string
  password: string
  rememberMe: boolean
}

type LocationState = {
  from?: string
}

export function LoginForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '', rememberMe: false },
  })

  const from = (location.state as LocationState | null)?.from ?? '/dashboard'

  function mapErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return t('auth.login.errors.invalidCredentials')
      if (error.status === 429) {
        const lower = (error.message ?? '').toLowerCase()
        if (lower.includes('locked')) return t('auth.login.errors.locked')
        return t('auth.login.errors.rateLimited')
      }
    }
    return t('auth.login.errors.unexpected')
  }

  async function onSubmit(values: LoginFormValues) {
    try {
      const response = await login.mutateAsync({
        login: values.login,
        password: values.password,
        remember: values.rememberMe,
      })

      if (isSessionPayload(response)) {
        navigate(from, { replace: true })
        return
      }
      if (isMfaChallenge(response)) {
        navigate('/mfa', {
          replace: true,
          state: {
            mode: 'challenge',
            mfaToken: response.mfaToken,
            mfaMethod: response.mfaMethod,
            remember: values.rememberMe,
            from,
          },
        })
        return
      }
      if (isMfaSetupRequired(response)) {
        navigate('/mfa', {
          replace: true,
          state: {
            mode: 'setup',
            mfaToken: response.mfaToken,
            remember: values.rememberMe,
          },
        })
        return
      }
    } catch {
      // Erro tratado pelo `login.error` no JSX abaixo.
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {login.isError && (
          <Alert variant="destructive">
            <AlertDescription>{mapErrorMessage(login.error)}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="login"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.loginField')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  placeholder={t('auth.login.loginPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.login?.message
                  ? t(form.formState.errors.login.message)
                  : null}
              </FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder={t('auth.login.passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.password?.message
                  ? t(form.formState.errors.password.message)
                  : null}
              </FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <FormLabel className="cursor-pointer text-sm font-normal">
                {t('auth.login.rememberMe')}
              </FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>

        <div className="text-center text-sm">
          <Link
            to="/forgot-password"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
      </form>
    </Form>
  )
}
