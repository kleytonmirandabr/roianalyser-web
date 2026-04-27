import { Check, ChevronRight, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { autoMapColumns, parseCsv, type ParsedCsv } from '@/features/imports/lib/csv'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { cn } from '@/shared/lib/cn'

export type ImportField = {
  fieldKey: string
  label: string
  required?: boolean
  /** Headers de CSV que deveriam mapear para este campo (auto-map). */
  candidates: string[]
}

export type ImportWizardProps = {
  /** Título da página (ex: "Importar Empresas"). */
  title: string
  /** Subtítulo legível (ex: "1726 linhas em CSV → catálogo de companies"). */
  subtitle?: string
  /** Schema de campos do destino. */
  schema: ImportField[]
  /**
   * Callback executado para cada linha durante o import.
   * Deve retornar Promise resolved em sucesso, rejected em erro.
   */
  importRow: (row: Record<string, string>) => Promise<void>
  /** Callback ao concluir todas as linhas (para invalidar caches, etc). */
  onComplete?: (summary: { total: number; ok: number; failed: number }) => void
}

type Step = 1 | 2 | 3 | 4

/**
 * Wizard genérico de importação CSV. Mesmo fluxo do vanilla
 * (`import-wizards.js`):
 *
 *   1. Upload   — escolhe arquivo CSV
 *   2. Mapping  — confere e ajusta o auto-map de colunas → campos
 *   3. Preview  — visualiza primeiras linhas do que será importado
 *   4. Import   — itera linhas chamando `importRow` (com contador progresso)
 *
 * Evita travas óbvias: rejeita CSV vazio, não move pro próximo passo se
 * mapping de campo `required` está vazio.
 */
export function ImportWizard({
  title,
  subtitle,
  schema,
  importRow,
  onComplete,
}: ImportWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [csv, setCsv] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)

  const headers = csv?.headers ?? []
  const rows = csv?.rows ?? []

  async function handleFile(f: File) {
    setError(null)
    setFile(f)
    try {
      const text = await f.text()
      const parsed = parseCsv(text)
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError(t('imports.errEmpty'))
        return
      }
      setCsv(parsed)
      setMapping(autoMapColumns(parsed.headers, schema))
      setStep(2)
    } catch (e) {
      setError(t('imports.errParse'))
      console.error(e)
    }
  }

  function canProceedFromMapping(): boolean {
    return schema.every(
      (s) => !s.required || (mapping[s.fieldKey] && mapping[s.fieldKey] !== ''),
    )
  }

  async function runImport() {
    setRunning(true)
    setFinished(false)
    setProgress({ done: 0, total: rows.length, failed: 0 })
    let ok = 0
    let failed = 0
    for (let i = 0; i < rows.length; i++) {
      const csvRow = rows[i]
      // Mapeia colunas CSV → fieldKey
      const out: Record<string, string> = {}
      for (const f of schema) {
        const header = mapping[f.fieldKey]
        out[f.fieldKey] = header ? csvRow[header] ?? '' : ''
      }
      try {
        await importRow(out)
        ok++
      } catch (err) {
        failed++
        console.error('import row failed', err, out)
      }
      setProgress({ done: i + 1, total: rows.length, failed })
    }
    setRunning(false)
    setFinished(true)
    onComplete?.({ total: rows.length, ok, failed })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <Stepper step={step} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <StepUpload
          file={file}
          onPick={handleFile}
          onCancel={() => setFile(null)}
        />
      )}

      {step === 2 && csv && (
        <StepMapping
          schema={schema}
          headers={headers}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep(1)}
          onNext={() => {
            if (!canProceedFromMapping()) {
              setError(t('imports.errMapping'))
              return
            }
            setError(null)
            setStep(3)
          }}
        />
      )}

      {step === 3 && csv && (
        <StepPreview
          schema={schema}
          mapping={mapping}
          rows={rows}
          onBack={() => setStep(2)}
          onNext={() => {
            setStep(4)
            runImport()
          }}
        />
      )}

      {step === 4 && (
        <StepImport
          progress={progress}
          running={running}
          finished={finished}
          onRestart={() => {
            setStep(1)
            setFile(null)
            setCsv(null)
            setMapping({})
            setProgress({ done: 0, total: 0, failed: 0 })
            setFinished(false)
          }}
        />
      )}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation()
  const labels = [
    t('imports.steps.upload'),
    t('imports.steps.mapping'),
    t('imports.steps.preview'),
    t('imports.steps.import'),
  ]
  return (
    <ol className="flex items-center gap-2 overflow-x-auto rounded-md border border-border bg-card p-2 text-sm">
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        return (
          <li key={n} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                n < step
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : n === step
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-muted text-muted-foreground',
              )}
            >
              {n < step ? <Check className="h-3 w-3" /> : n}
            </span>
            <span
              className={cn(
                'font-medium',
                n === step ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {n < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </li>
        )
      })}
    </ol>
  )
}

function StepUpload({
  file,
  onPick,
  onCancel,
}: {
  file: File | null
  onPick: (f: File) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('imports.upload.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('imports.upload.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            {file?.name ?? t('imports.upload.pick')}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
            }}
          />
        </label>
        {file && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="self-start"
          >
            <X className="h-4 w-4" />
            <span>{t('common.cancel')}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function StepMapping({
  schema,
  headers,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  schema: ImportField[]
  headers: string[]
  mapping: Record<string, string>
  onChange: (m: Record<string, string>) => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('imports.mapping.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('imports.mapping.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {schema.map((f) => (
            <div key={f.fieldKey} className="space-y-1.5">
              <Label htmlFor={`map-${f.fieldKey}`}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              <select
                id={`map-${f.fieldKey}`}
                value={mapping[f.fieldKey] ?? ''}
                onChange={(e) =>
                  onChange({ ...mapping, [f.fieldKey]: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— {t('imports.mapping.none')} —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button onClick={onNext}>{t('imports.mapping.next')}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StepPreview({
  schema,
  mapping,
  rows,
  onBack,
  onNext,
}: {
  schema: ImportField[]
  mapping: Record<string, string>
  rows: Record<string, string>[]
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const sample = useMemo(() => rows.slice(0, 10), [rows])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('imports.preview.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('imports.preview.description', { count: rows.length })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {schema.map((f) => (
                  <TableHead key={f.fieldKey}>{f.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.map((row, idx) => (
                <TableRow key={idx}>
                  {schema.map((f) => {
                    const header = mapping[f.fieldKey]
                    return (
                      <TableCell key={f.fieldKey} className="text-sm">
                        {header ? row[header] || '—' : '—'}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between p-4">
          <Button variant="outline" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button onClick={onNext}>
            {t('imports.preview.runFor', { count: rows.length })}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StepImport({
  progress,
  running,
  finished,
  onRestart,
}: {
  progress: { done: number; total: number; failed: number }
  running: boolean
  finished: boolean
  onRestart: () => void
}) {
  const { t } = useTranslation()
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('imports.import.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {running && (
          <p className="text-sm text-muted-foreground">
            {t('imports.import.progress', {
              done: progress.done,
              total: progress.total,
            })}
          </p>
        )}
        {finished && (
          <Alert>
            <AlertDescription>
              {t('imports.import.done', {
                ok: progress.total - progress.failed,
                failed: progress.failed,
              })}
            </AlertDescription>
          </Alert>
        )}
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full bg-primary transition-all',
              progress.failed > 0 && 'bg-amber-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!running && !finished && <Skeleton className="h-10 w-full" />}
        {finished && (
          <Button onClick={onRestart}>{t('imports.import.restart')}</Button>
        )}
      </CardContent>
    </Card>
  )
}
