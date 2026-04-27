import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { PublicPageShell } from '@/features/auth/components/public-page-shell'
import { useForgotPassword } from '@/features/auth/hooks/use-forgot-password'
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
import { Input } from '@/shared/ui/input'

const schema = z.object({
  login: z.string().min(1, 'auth.login.errors.loginRequired'),
})

type FormValues = {
  login: string
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const forgot = useForgotPassword()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: '' },
  })

  async function onSubmit(values: FormValues) {
    try {
      await forgot.mutateAsync(values.login)
    } catch {
      // O backend sempre responde 200 para evitar enumeração de e-mails;
      // qualquer erro real cai aqui e é tratado por forgot.isError.
    }
  }

  return (
    <PublicPageShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle>{t('auth.forgotPassword.title')}</CardTitle>
          <CardDescription>
            {t('auth.forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forgot.isSuccess ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {t('auth.forgotPassword.success')}
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
                <FormField
                  control={form.control}
                  name="login"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('auth.forgotPassword.loginField')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="email"
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={forgot.isPending}
                >
                  {forgot.isPending
                    ? t('auth.forgotPassword.submitting')
                    : t('auth.forgotPassword.submit')}
                </Button>
                <Link
                  to="/login"
                  className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </PublicPageShell>
  )
}
