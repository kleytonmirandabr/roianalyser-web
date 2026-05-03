/**
 * Página pública do formulário de projeto.
 * Rota: /f/:token (sem AppShell, sem autenticação obrigatória)
 *
 * GET  /api/f/:token         → resposta flat: { id, title, description, layout, fields, ... }
 * POST /api/f/:token/submit  → body: { values: { title, description, plannedDate, col_<id>, ... } }
 */
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { publicFormApi } from '@/features/projects2/form-api'
import type { FormField } from '@/features/projects2/form-types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

// ── Field renderer ─────────────────────────────────────────────────────────

function FieldInput({
  field, value, onChange, error,
}: { field: FormField; value: any; onChange: (v: any) => void; error?: string }) {
  const base = [
    'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-primary/50',
    error ? 'border-rose-400' : '',
  ].join(' ')

  if (field.type === 'long_text') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className={base + ' resize-none'}
        placeholder={field.label + '...'}
      />
    )
  }

  if ((field.type === 'select' || field.type === 'status') && field.options?.length) {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={base}>
        <option value="">Selecione...</option>
        {field.options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-sm">{field.label}</span>
      </label>
    )
  }

  if (field.type === 'date') {
    return (
      <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} className={base} />
    )
  }

  if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
    return (
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} className={base} placeholder="0" />
    )
  }

  if (field.type === 'rating') {
    const num = Number(value) || 0
    return (
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} type="button" onClick={() => onChange(s)}
            className={`text-2xl leading-none ${num >= s ? 'text-amber-400' : 'text-muted-foreground/30'}`}
          >★</button>
        ))}
      </div>
    )
  }

  return (
    <Input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.label}
      className={error ? 'border-rose-400' : ''}
    />
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

type FormConfig = Awaited<ReturnType<typeof publicFormApi.get>>

/** Map field key → submit body key.
 *  Built-ins: 'title', 'description', 'plannedDate', 'status' → same
 *  Custom columns: col.id → 'col_<id>'
 */
function fieldToValueKey(field: FormField): string {
  const BUILTIN = new Set(['title', 'description', 'plannedDate', 'status'])
  return BUILTIN.has(field.key) ? field.key : `col_${field.key}`
}

function validate(fields: FormField[], values: Record<string, any>): Record<string, string> {
  const errs: Record<string, string> = {}
  fields.forEach(f => {
    if (!f.required) return
    const v = values[fieldToValueKey(f)]
    if (v === null || v === undefined || v === '') errs[f.key] = 'Campo obrigatório'
  })
  return errs
}

// ── Public page ────────────────────────────────────────────────────────────

export function ProjectFormPage() {
  const { token } = useParams<{ token: string }>()

  const [form, setForm] = useState<FormConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!token) return
    publicFormApi.get(token)
      .then(d => setForm(d))
      .catch(e => setLoadErr((e as Error).message))
      .finally(() => setLoading(false))
  }, [token])

  const fields = form?.fields ?? []
  const isCarousel = form?.layout === 'carousel'

  function set(key: string, val: any) {
    setValues(p => ({ ...p, [key]: val }))
    setErrors(p => { const n = { ...p }; delete n[key]; return n })
  }

  async function doSubmit() {
    if (!token || !form) return
    const errs = validate(fields, values)
    if (Object.keys(errs).length) { setErrors(errs); return }

    // Build flat values object keyed as backend expects
    const payload: Record<string, any> = {}
    fields.forEach(f => {
      payload[fieldToValueKey(f)] = values[fieldToValueKey(f)]
    })

    setSubmitting(true)
    setSubmitErr(null)
    try {
      await publicFormApi.submit(token, payload)
      setSubmitted(true)
    } catch (e) {
      setSubmitErr((e as Error).message || 'Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadErr || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-semibold">Formulário não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            {loadErr ?? 'Este formulário não existe ou não está mais disponível.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">{form.confirmationTitle || 'Enviado!'}</h1>
          <p className="text-muted-foreground text-sm">
            {form.confirmationMessage || 'Sua resposta foi registrada com sucesso.'}
          </p>
          <Button variant="outline" onClick={() => {
            setSubmitted(false); setValues({}); setStep(0)
          }}>
            Enviar outra resposta
          </Button>
        </div>
      </div>
    )
  }

  // ── List layout ──────────────────────────────────────────────────────────

  if (!isCarousel) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">{form.title}</h1>
            {form.description && <p className="text-muted-foreground text-sm">{form.description}</p>}
          </div>

          <div className="space-y-4">
            {fields.map(f => {
              const vKey = fieldToValueKey(f)
              return (
                <div key={f.key}>
                  <Label>
                    {f.label}
                    {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                  </Label>
                  <FieldInput
                    field={f} value={values[vKey]}
                    onChange={v => set(vKey, v)} error={errors[f.key]}
                  />
                  {errors[f.key] && <p className="text-xs text-rose-500 mt-0.5">{errors[f.key]}</p>}
                </div>
              )
            })}
          </div>

          {submitErr && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {submitErr}
            </div>
          )}

          <Button className="w-full" onClick={doSubmit} disabled={submitting}>
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              : <><Send className="h-4 w-4 mr-2" />Enviar</>
            }
          </Button>
        </div>
      </div>
    )
  }

  // ── Carousel layout ──────────────────────────────────────────────────────

  const currentField = fields[step]
  const isLast = step === fields.length - 1

  function goNext() {
    const f = currentField
    if (f?.required) {
      const vKey = fieldToValueKey(f)
      const v = values[vKey]
      if (v === null || v === undefined || v === '') {
        setErrors(p => ({ ...p, [f.key]: 'Campo obrigatório' }))
        return
      }
    }
    if (isLast) { doSubmit(); return }
    setStep(s => s + 1)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted w-full">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((step + 1) / fields.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          {step === 0 && (
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">{form.title}</h1>
              {form.description && <p className="text-muted-foreground text-sm">{form.description}</p>}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">{step + 1} / {fields.length}</p>

          {currentField && (() => {
            const vKey = fieldToValueKey(currentField)
            return (
              <div className="space-y-2">
                <Label className="text-lg font-semibold">
                  {currentField.label}
                  {currentField.required && <span className="text-rose-500 ml-0.5">*</span>}
                </Label>
                <FieldInput
                  field={currentField} value={values[vKey]}
                  onChange={v => set(vKey, v)} error={errors[currentField.key]}
                />
                {errors[currentField.key] && (
                  <p className="text-sm text-rose-500">{errors[currentField.key]}</p>
                )}
              </div>
            )
          })()}

          {submitErr && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {submitErr}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button onClick={goNext} disabled={submitting}>
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</>
                : isLast
                  ? <><Send className="h-4 w-4 mr-1" />Enviar</>
                  : <>Próximo <ArrowRight className="h-4 w-4 ml-1" /></>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
