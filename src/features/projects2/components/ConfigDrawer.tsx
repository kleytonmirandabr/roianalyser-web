import { useState } from 'react'
import { X, BarChart3, TrendingUp, PieChart, Table2, Hash } from 'lucide-react'
import type { AnalyticsDataset, ReportConfig, ChartType, AggregationFn, FilterOperator, QueryFilter } from '../analytics-types'

interface Props {
  open: boolean
  onClose: () => void
  datasets: AnalyticsDataset[]
  initial?: Partial<ReportConfig> & { name?: string; dataset?: string }
  onSave: (name: string, dataset: string, config: ReportConfig) => void
}

const CHART_TYPES: Array<{ value: ChartType; label: string; Icon: React.ElementType }> = [
  { value: 'bar',   label: 'Barras',   Icon: BarChart3 },
  { value: 'line',  label: 'Linha',    Icon: TrendingUp },
  { value: 'pie',   label: 'Pizza',    Icon: PieChart },
  { value: 'table', label: 'Tabela',   Icon: Table2 },
  { value: 'kpi',   label: 'KPI',      Icon: Hash },
]

const AGGREGATIONS: Array<{ value: AggregationFn; label: string }> = [
  { value: 'count', label: 'Contagem' },
  { value: 'sum',   label: 'Soma' },
  { value: 'avg',   label: 'Média' },
  { value: 'min',   label: 'Mínimo' },
  { value: 'max',   label: 'Máximo' },
]

const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'eq',       label: '= igual' },
  { value: 'neq',      label: '≠ diferente' },
  { value: 'contains', label: 'contém' },
  { value: 'gt',       label: '> maior' },
  { value: 'lt',       label: '< menor' },
  { value: 'notnull',  label: 'preenchido' },
  { value: 'isnull',   label: 'vazio' },
]

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#14b8a6','#f97316']

export function ConfigDrawer({ open, onClose, datasets, initial, onSave }: Props) {
  const [tab, setTab] = useState<'campos' | 'visual' | 'filtros' | 'ordenacao'>('campos')
  const [name, setName] = useState(initial?.name ?? 'Novo card')
  const [dataset, setDataset] = useState(initial?.dataset ?? datasets[0]?.key ?? '')
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? 'bar')
  const [groupBy, setGroupBy] = useState(initial?.query?.groupBy ?? '')
  const [valueField, setValueField] = useState(initial?.query?.valueField ?? '')
  const [aggregation, setAggregation] = useState<AggregationFn>(initial?.query?.aggregation ?? 'count')
  const [filters, setFilters] = useState<QueryFilter[]>(initial?.query?.filters ?? [])
  const [sortField, setSortField] = useState(initial?.query?.sortField ?? '')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>(initial?.query?.sortDir ?? 'desc')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [kpiLabel, setKpiLabel] = useState(initial?.kpiLabel ?? '')

  if (!open) return null

  const ds = datasets.find(d => d.key === dataset)
  const fields = ds?.fields ?? []

  function addFilter() {
    setFilters(f => [...f, { field: fields[0]?.key ?? '', operator: 'eq', value: '' }])
  }

  function handleSave() {
    const config: ReportConfig = {
      chartType,
      color,
      kpiLabel: kpiLabel || undefined,
      query: {
        dataset,
        groupBy: groupBy || undefined,
        valueField: valueField || undefined,
        aggregation,
        filters: filters.filter(f => f.field),
        sortField: sortField || undefined,
        sortDir,
      },
    }
    onSave(name, dataset, config)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* drawer */}
      <div className="w-full max-w-sm bg-background shadow-xl flex flex-col h-full border-l">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">Configurar card</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* name + dataset */}
        <div className="p-4 border-b space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome do card</label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm bg-background"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dataset</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm bg-background"
              value={dataset}
              onChange={e => setDataset(e.target.value)}
            >
              {datasets.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
        </div>

        {/* tabs */}
        <div className="flex border-b text-xs">
          {(['campos','visual','filtros','ordenacao'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 capitalize font-medium transition-colors ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'ordenacao' ? 'Ordenação' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {tab === 'campos' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Agrupar por</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                  <option value="">— sem agrupamento —</option>
                  {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              {groupBy && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Campo de valor</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={valueField} onChange={e => setValueField(e.target.value)}>
                      <option value="">— nenhum —</option>
                      {fields.filter(f => f.type === 'number').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Agregação</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={aggregation} onChange={e => setAggregation(e.target.value as AggregationFn)}>
                      {AGGREGATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </>
              )}
              {chartType === 'kpi' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Label do KPI</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={kpiLabel} onChange={e => setKpiLabel(e.target.value)} placeholder="ex: Total de tarefas" />
                </div>
              )}
            </>
          )}

          {tab === 'visual' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Tipo de visualização</label>
                <div className="grid grid-cols-3 gap-2">
                  {CHART_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => setChartType(ct.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded border text-xs transition-colors ${chartType === ct.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted/50'}`}
                    >
                      <ct.Icon size={18} />
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-primary scale-110' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'filtros' && (
            <>
              {filters.map((f, i) => (
                <div key={i} className="flex gap-1 items-start">
                  <select
                    className="flex-1 border rounded px-1.5 py-1 text-xs bg-background"
                    value={f.field}
                    onChange={e => setFilters(fls => fls.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                  >
                    {fields.map(fld => <option key={fld.key} value={fld.key}>{fld.label}</option>)}
                  </select>
                  <select
                    className="flex-1 border rounded px-1.5 py-1 text-xs bg-background"
                    value={f.operator}
                    onChange={e => setFilters(fls => fls.map((x, j) => j === i ? { ...x, operator: e.target.value as FilterOperator } : x))}
                  >
                    {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  {!['notnull','isnull'].includes(f.operator) && (
                    <input
                      className="flex-1 border rounded px-1.5 py-1 text-xs bg-background"
                      value={String(f.value ?? '')}
                      onChange={e => setFilters(fls => fls.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      placeholder="valor"
                    />
                  )}
                  <button onClick={() => setFilters(fls => fls.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive mt-1">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={addFilter} className="text-xs text-primary hover:underline">+ Adicionar filtro</button>
            </>
          )}

          {tab === 'ordenacao' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ordenar por</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={sortField} onChange={e => setSortField(e.target.value)}>
                  <option value="">— padrão —</option>
                  {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Direção</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={sortDir} onChange={e => setSortDir(e.target.value as 'asc'|'desc')}>
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-muted/50">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground rounded py-2 text-sm font-medium hover:opacity-90">Salvar</button>
        </div>
      </div>
    </div>
  )
}
