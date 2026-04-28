/**
 * Cadastro de novo projeto/oportunidade.
 *
 * O formulário é DINÂMICO — lê a configuração de "Formulário da Oportunidade"
 * (catalog `contractFormFields` + `customFields`) e renderiza só os campos
 * marcados como visíveis, com `required` correto.
 *
 * Cada campo PADRÃO tem um mapeamento (em `STANDARD_FIELDS`) que define:
 *   - Onde o valor é gravado: top-level `name`/`status`/`currency` ou
 *     dentro de `payload[chave]`.
 *   - Como renderizar: text/textarea/email/phone/number/date/currency/
 *     percent/combobox de status/combobox de moeda/catalogRef.
 *
 * Custom fields seguem o mesmo padrão via `<CustomFieldRenderer>` (todos
 * vão pra `payload[fieldKey]`).
 *
 * Validação `required` é avaliada no submit — não usamos zod schema
 * dinâmico aqui pra evitar reflective hell. Só chamada explícita no
 * onSubmit, abrindo erro inline embaixo do campo.
 */

import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  STANDARD_FIELDS_BY_ID,
  mergeFields,
  type CustomFieldItem,
  type ManifestItem,
  type UnifiedField,
} from '@/features/admin/lib/contract-form-fields'
import {
  CustomFieldRenderer,
  type CustomFieldDef,
} from '@/features/catalogs/components/custom-field-renderer'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useCreateProject } from '@/features/projects/hooks/use-create-project'
import type { CreateProjectInput, ProjectPayload } from '@/features/projects/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/cn'

const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'BRL — Real brasileiro' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'PYG', label: 'PYG — Guarani paraguaio' },
  { value: 'UYU', label: 'UYU — Peso uruguaio' },
  { value: 'GBP', label: 'GBP — Libra esterlina' },
]

export function NewProjectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const create = useCreateProject()
  const { user } = useAuth()
  const isFromOpportunities = location.pathname.startsWith('/opportunities')

  // Config: manifesto + custom fields. Mescla pra ter lista unificada
  // ordenada e com defaults preenchidos.
  const manifest = useCatalog('contractFormFields')
  const customs = useCatalog('customFields')
  const projectStatuses = useCatalog('projectStatuses')
  const leadSources = useCatalog('leadSources')
  const contractTypes = useCatalog('contractTypes')
  const companies = useCatalog('companies')

  const fields = useMemo<UnifiedField[]>(() => {
    return mergeFields(
      (manifest.data ?? []) as unknown as ManifestItem[],
      (customs.data ?? []) as unknown as CustomFieldItem[],
    ).filter((f) => f.visible)
  }, [manifest.data, customs.data])

  // Estado dos valores. Top-level (name/status/currency) e payload livre.
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Defaults: moeda BRL e responsável = user logado (auto-fill).
  // Caso o user troque de conta, o useEffect re-roda e atualiza o responsável
  // (se ainda estiver vazio — não sobrescreve se admin já mudou pra outro nome).
  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev }
      if (!next.projectCurrency) next.projectCurrency = 'BRL'
      if (!next.projectOwner && user) {
        next.projectOwner = user.name || user.email || ''
      }
      return next
    })
  }, [user])

  function setValue(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }))
    setErrors((prev) => {
      if (!prev[id]) return prev
      const { [id]: _drop, ...rest } = prev
      return rest
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    for (const f of fields) {
      if (!f.required) continue
      const v = values[f.id]
      const empty =
        v == null || v === '' || (Array.isArray(v) && v.length === 0)
      if (empty) e[f.id] = 'Campo obrigatório'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    /**
     * Pra cada campo, decide se vai pro top-level ou pro payload baseado
     * no STANDARD_FIELDS_BY_ID[id].storage (padrão) ou no `fieldKey` do
     * custom (sempre payload).
     */
    const payload: ProjectPayload = {}
    let topName: string | undefined
    let topStatus: string | undefined
    let topCurrency: string | undefined

    for (const f of fields) {
      const v = values[f.id]
      if (v == null || v === '') continue
      if (f.kind === 'standard') {
        const def = STANDARD_FIELDS_BY_ID[f.id]
        if (!def) continue
        switch (def.storage) {
          case 'name':
            topName = String(v)
            break
          case 'status':
            topStatus = String(v)
            break
          case 'currency':
            topCurrency = String(v)
            break
          case 'payload': {
            const key = def.payloadKey ?? def.id
            ;(payload as Record<string, unknown>)[key] = v
            break
          }
        }
      } else {
        // custom
        ;(payload as Record<string, unknown>)[f.fieldKey] = v
      }
    }

    const input: CreateProjectInput = {
      name: topName ?? 'Sem nome',
      status: topStatus ?? 'draft',
      currency: topCurrency ?? 'BRL',
      payload: Object.keys(payload).length ? payload : undefined,
    }

    try {
      const project = await create.mutateAsync(input)
      navigate(`/projects/${project.id}/info`, { replace: true })
    } catch {
      // useCreateProject expõe isError; render abaixo mostra Alert.
    }
  }

  // Loading do config.
  const loading =
    manifest.isLoading || customs.isLoading || projectStatuses.isLoading
  // Sem clientId = master sem tenant ativo. Mostra prompt e não tenta criar.
  const hasTenant = !!user?.clientId || !!user?.isMaster

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={isFromOpportunities ? '/opportunities' : '/projects'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {isFromOpportunities ? t('nav.opportunities') : t('nav.projects')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {isFromOpportunities
              ? t('projects.newOpportunity', { defaultValue: 'Nova oportunidade' })
              : t('projects.new')}
          </CardTitle>
          <CardDescription>
            {t('projects.newSubtitle', {
              defaultValue:
                'Preencha os campos. A configuração de quais campos aparecem (padrão e customizados) está em Catálogos → Formulário da Oportunidade.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasTenant && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Selecione um cliente no header pra criar oportunidade/projeto.
              </AlertDescription>
            </Alert>
          )}
          {create.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{t('projects.createError')}</AlertDescription>
            </Alert>
          )}
          {loading && (
            <p className="text-sm text-muted-foreground">Carregando campos...</p>
          )}

          {!loading && fields.length === 0 && (
            <Alert className="mb-4">
              <AlertDescription>
                Nenhum campo configurado. Configure em{' '}
                <Link
                  to="/catalogs/contract-form"
                  className="underline-offset-2 hover:underline"
                >
                  Catálogos → Formulário da Oportunidade
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}

          {!loading && fields.length > 0 && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              {fields.map((f) => (
                <FieldEditor
                  key={f.id}
                  field={f}
                  value={values[f.id]}
                  onChange={(v) => setValue(f.id, v)}
                  error={errors[f.id]}
                  catalogs={{
                    projectStatuses: projectStatuses.data ?? [],
                    leadSources: leadSources.data ?? [],
                    contractTypes: contractTypes.data ?? [],
                    companies: companies.data ?? [],
                  }}
                />
              ))}

              <div className="md:col-span-2 flex gap-2 border-t border-border pt-4">
                <Button type="submit" disabled={create.isPending || !hasTenant}>
                  {create.isPending ? t('projects.creating') : t('projects.create')}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to={isFromOpportunities ? '/opportunities' : '/projects'}>
                    {t('common.cancel')}
                  </Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================
 * Field renderer — escolhe o input certo baseado no tipo do campo.
 * ======================================================================== */

type CatalogItemLite = { id: string; name?: unknown }

function FieldEditor({
  field,
  value,
  onChange,
  error,
  catalogs,
}: {
  field: UnifiedField
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  catalogs: {
    projectStatuses: { id: string; name?: unknown }[]
    leadSources: CatalogItemLite[]
    contractTypes: CatalogItemLite[]
    companies: CatalogItemLite[]
  }
}) {
  const id = `field-${field.id}`

  if (field.kind === 'custom') {
    const cfDef: CustomFieldDef = {
      id: field.id,
      name: field.label,
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      required: field.required,
      visible: field.visible,
      options: field.options,
    }
    return (
      <div className={cn('space-y-1.5', 'md:col-span-1')}>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <CustomFieldRenderer field={cfDef} value={value} onChange={onChange} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Standard field — render conforme renderType
  const def = STANDARD_FIELDS_BY_ID[field.id]
  if (!def) return null

  const span = def.fullWidth ? 'md:col-span-2' : 'md:col-span-1'
  const stringVal =
    value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)

  if (def.renderType === 'combobox-currency') {
    return (
      <div className={cn('space-y-1.5', span)}>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Combobox
          id={id}
          options={CURRENCY_OPTIONS}
          value={stringVal}
          onChange={onChange}
          placeholder="Selecione a moeda"
          noneLabel="—"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (def.renderType === 'combobox-status') {
    const opts = (catalogs.projectStatuses ?? [])
      .filter((s) => typeof s.name === 'string' && s.name)
      .map((s) => ({ value: String(s.name), label: String(s.name) }))
    return (
      <div className={cn('space-y-1.5', span)}>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Combobox
          id={id}
          options={opts}
          value={stringVal}
          onChange={onChange}
          placeholder="Selecione o status"
          noneLabel="—"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (def.renderType === 'catalogRef' && def.refCatalog) {
    const list = catalogs[def.refCatalog] ?? []
    const opts = list
      .filter((it) => typeof it.name === 'string' && it.name)
      .map((it) => ({ value: it.id, label: String(it.name) }))
    return (
      <div className={cn('space-y-1.5', span)}>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Combobox
          id={id}
          options={opts}
          value={stringVal}
          onChange={onChange}
          placeholder="—"
          noneLabel="—"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Inputs simples — tipo HTML conforme renderType.
  const inputType =
    def.renderType === 'date'
      ? 'date'
      : def.renderType === 'email'
        ? 'email'
        : def.renderType === 'phone'
          ? 'tel'
          : def.renderType === 'number' ||
              def.renderType === 'percent' ||
              def.renderType === 'currency'
            ? 'number'
            : 'text'
  const inputStep =
    def.renderType === 'currency'
      ? '0.01'
      : def.renderType === 'percent'
        ? '0.01'
        : undefined

  if (def.renderType === 'textarea') {
    return (
      <div className={cn('space-y-1.5', span)}>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <textarea
          id={id}
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', span)}>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={inputType}
        step={inputStep}
        value={stringVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        autoFocus={def.id === 'projectName'}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
