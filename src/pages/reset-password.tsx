import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { PublicPageShell } from '@/features/auth/components/public-page-shell'
import { useResetPassword } from '@/features/auth/hooks/use-reset-password'
import { ApiError } from '@/shared/api/client'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { PasswordInput } from '@/shared/ui/password-input'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'auth.resetPassword.errors.weak')
      .regex(/[a-z]/, 'auth.resetPassword.errors.weak')
      .regex(/[A-Z]/, 'auth.resetPassword.errors.weak')
      .regex(/\d/, 'auth.resetPassword.errors.weak')
      .regex(/[^A-Za-z0-9]/, 'auth.resetPassword.errors.weak'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'auth.resetPassword.errors.mismatch',
  })

type FormValues = {
  newPassword: string
  confirmPassword: string
}

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const reset = useResetPassword()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  if (!token) {
    return <Navigate to="/forgot-password" replace />
  }

  function mapErrorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 400) {
      return t('auth.resetPassword.errors.invalidToken')
    }
    return t('app.error')
  }

  async function onSubmit(values: FormValues) {
    try {
      await reset.mutateAsync({ token, newPassword: values.newPassword })
    } catch {
      // exibido por reset.error.
    }
  }

  return (
    <PublicPageShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
          <CardDescription>
            {t('auth.resetPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reset.isSuccess ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {t('auth.resetPassword.success')}
                </AlertDescription>
              </Alert>
              <Link
                to="/login"
                className="block text-center text-sm text-primary underline-offset-4 hover:underline"
              >
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {reset.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {mapErrorMessage(reset.error)}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('auth.resetPassword.newPassword')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage>
                        {form.formState.errors.newPassword?.message
                          ? t(form.formState.errors.newPassword.message)
                          : null}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('auth.resetPassword.confirmPassword')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage>
                        {form.formState.errors.confirmPassword?.message
                          ? t(form.formState.errors.confirmPassword.message)
                          : null}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={reset.isPending}
                >
                  {reset.isPending
                    ? t('auth.resetPassword.submitting')
                    : t('auth.resetPassword.submit')}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </PublicPageShell>
  )
}
