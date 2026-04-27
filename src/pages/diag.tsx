import { Copy } from 'lucide-react'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { useProject } from '@/features/projects/hooks/use-project'
import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import { formatCurrency } from '@/features/projects/lib/money'
import { toast, toastError } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'

/**
 * Tela de diagnóstico/paridade — rota oculta `/diag/:projectId`.
 *
 * Mostra lado a lado:
 *   1. Payload completo do projeto (cru, JSON)
 *   2. Inputs financeiros lidos (prazo, comissão, impostos)
 *   3. Cash flow mensal calculado pelo motor React
 *   4. Métricas consolidadas (totalRevenue, totalCost, payback, etc)
 *
 * Útil para comparar com o vanilla aberto noutra aba e validar paridade.
 */
export function DiagPage() {
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)

  const payload = (project.data?.payload ?? null) as
    | Record<string, unknown>
    | null
  const inputs = useMemo(() => readFinancialInputs(payload), [payload])
  const cashFlow = useMemo(
    () => (payload ? buildCashFlow(payload, inputs) : []),
    [payload, inputs],
  )
  const metrics = useMemo(() => computeMetrics(cashFlow), [cashFlow])
  const currency = project.data?.currency ?? 'BRL'

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success('Payload copiado para o clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  if (!params.id) return null

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Diagnóstico — {project.data?.name ?? 'projeto'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Snapshot completo dos dados e cálculos do projeto. Útil para
          comparar com o vanilla e identificar desvios numéricos.
        </p>
      </div>

      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>Não foi possível carregar.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inputs financeiros</CardTitle>
          <CardDescription>
            Lidos via `readFinancialInputs(payload)`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(inputs, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métricas consolidadas</CardTitle>
          <CardDescription>
            `computeMetrics(buildCashFlow(payload, inputs))`.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Metric
            label="Receita total (líquida)"
            value={formatCurrency(metrics.totalRevenue, currency)}
          />
          <Metric
            label="Receita bruta"
            value={formatCurrency(
              metrics.totalRecurringRevenue + metrics.totalOneTimeRevenue,
              currency,
            )}
          />
          <Metric
            label="Comissão+impostos"
            value={formatCurrency(metrics.totalFinancial, currency)}
          />
          <Metric
            label="Custo total"
            value={formatCurrency(metrics.totalCost, currency)}
          />
          <Metric
            label="Resultado total"
            value={formatCurrency(metrics.totalResult, currency)}
            tone={metrics.totalResult >= 0 ? 'good' : 'bad'}
          />
          <Metric label="Margem" value={`${metrics.margin.toFixed(2)}%`} />
          <Metric
            label="Payback"
            value={
              metrics.paybackMonth != null
                ? `mês ${metrics.paybackMonth}`
                : 'não atinge'
            }
            tone={metrics.paybackMonth != null ? 'good' : 'bad'}
          />
          <Metric
            label="Pico/vale acumulado"
            value={`${formatCurrency(
              metrics.peakAccum,
              currency,
            )} / ${formatCurrency(metrics.troughAccum, currency)}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash flow mês a mês</CardTitle>
          <CardDescription>
            {cashFlow.length} meses calculados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(cashFlow, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">Payload bruto</CardTitle>
            <CardDescription>
              Tudo que está gravado no `project.payload` no backend.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={copyPayload}>
            <Copy className="h-4 w-4" />
            <span>Copiar JSON</span>
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[600px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  const toneCls =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'bad'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  )
}
