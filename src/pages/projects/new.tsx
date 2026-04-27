import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useCreateProject } from '@/features/projects/hooks/use-create-project'
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

type FormValues = {
  name: string
  currency: string
}

export function NewProjectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateProject()

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('projects.detail.info.errNameRequired')),
        currency: z
          .string()
          .min(1, t('projects.detail.info.errCurrencyRequired'))
          .default('BRL'),
      }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: 'BRL' },
  })

  async function onSubmit(values: FormValues) {
    const project = await create.mutateAsync({
      name: values.name,
      currency: values.currency,
      status: 'draft',
    })
    navigate(`/projects/${project.id}/info`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('nav.projects')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('projects.new')}</CardTitle>
          <CardDescription>
            {t('projects.newSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {create.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {t('projects.createError')}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.newName')}</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.th.currency')}</FormLabel>
                    <FormControl>
                      <Input maxLength={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending
                    ? t('projects.creating')
                    : t('projects.create')}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to="/projects">{t('common.cancel')}</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
