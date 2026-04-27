import { useMemo } from 'react'

import type { CashFlowMonth } from '@/features/projects/lib/financials'
import { formatCurrency } from '@/features/projects/lib/money'

type Props = {
  cashFlow: CashFlowMonth[]
  currency: string
  height?: number
}

/**
 * Gráfico de barras simples em SVG puro (sem dependências), mostrando
 * o **acumulado mês a mês**. Verde quando positivo, vermelho quando
 * negativo. Eixo zero destacado.
 */
export function CashFlowChart({ cashFlow, currency, height = 220 }: Props) {
  const { paths, zeroY, padding, width, max, min } = useMemo(() => {
    const padding = { top: 12, right: 12, bottom: 24, left: 56 }
    const innerW = Math.max(200, cashFlow.length * 28)
    const width = padding.left + innerW + padding.right
    const innerH = height - padding.top - padding.bottom

    const values = cashFlow.map((m) => m.accum)
    const max = Math.max(0, ...values)
    const min = Math.min(0, ...values)
    const range = max - min || 1
    const zeroY = padding.top + (max / range) * innerH

    const barWidth = innerW / Math.max(1, cashFlow.length)
    const paths = cashFlow.map((m, i) => {
      const x = padding.left + i * barWidth + 2
      const w = Math.max(1, barWidth - 4)
      const value = m.accum
      const yValue = padding.top + ((max - value) / range) * innerH
      const y = Math.min(yValue, zeroY)
      const h = Math.abs(yValue - zeroY)
      return {
        x,
        y,
        w,
        h,
        positive: value >= 0,
        month: m.month,
        accum: value,
      }
    })

    return { paths, zeroY, padding, width, max, min }
  }, [cashFlow, height])

  if (cashFlow.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Sem dados para o gráfico.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de fluxo de caixa acumulado"
      >
        <text
          x={padding.left - 6}
          y={padding.top + 4}
          textAnchor="end"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {formatCurrency(max, currency)}
        </text>
        <text
          x={padding.left - 6}
          y={zeroY + 4}
          textAnchor="end"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          0
        </text>
        <text
          x={padding.left - 6}
          y={height - padding.bottom + 4}
          textAnchor="end"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {formatCurrency(min, currency)}
        </text>

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {paths.map((p) => (
          <g key={p.month}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={2}
              fill={
                p.positive
                  ? 'hsl(142 71% 45% / 0.85)' // verde
                  : 'hsl(0 84% 60% / 0.85)' // vermelho
              }
            >
              <title>{`Mês ${p.month}: ${formatCurrency(p.accum, currency)}`}</title>
            </rect>
          </g>
        ))}

        {paths
          .filter((_, i) => i === 0 || (i + 1) % 6 === 0 || i === paths.length - 1)
          .map((p) => (
            <text
              key={`label-${p.month}`}
              x={p.x + p.w / 2}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
            >
              {p.month}
            </text>
          ))}
      </svg>
    </div>
  )
}
