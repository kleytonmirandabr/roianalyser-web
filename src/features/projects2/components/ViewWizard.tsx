/**
 * ViewWizard — modal wizard para adicionar/configurar uma view no workspace.
 *
 * Fluxo:
 *   Passo 0: Escolher tipo de view (se não fornecido)
 *   Passo 1+: Configuração específica por tipo
 *   Último: Confirmação + nome customizado
 */
import {
  BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight,
  ClipboardList, GanttChart, LayoutGrid, ListTodo, Paperclip, Users2, X,
} from 'lucide-react'
import { useState } from 'react'
import type { CalendarConfig, GanttConfig, KanbanConfig, ViewType } from '../view-types'
import { CONFIGURABLE_VIEW_TYPES, VIEW_TYPE_META } from '../view-types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ListTodo, LayoutGrid, CalendarDays, GanttChart, ClipboardList, Users2, Paperclip, BarChart3,
}

interface ViewWizardProps {
  onClose: () => void
  onDone: (type: ViewType, name: string, config: Record<string, unknown>) => void
  /** Se fornecido, pula o passo de escolha de tipo */
  initialType?: ViewType
}

// ─── Opções de campo para cada tipo ──────────────────────────────────────────

const DATE_FIELD_OPTIONS = [
  { value: 'dueDate',   label: 'Prazo (Due Date)' },
  { value: 'startDate', label: 'Data de início' },
  { value: 'createdAt', label: 'Data de criação' },
]

const COLOR_BY_OPTIONS = [
  { value: 'status',   label: 'Status da tarefa' },
  { value: 'assignee', label: 'Responsável' },
  { value: 'group',    label: 'Grupo' },
]

const CARD_FIELD_OPTIONS = [
  { value: 'assignees',   label: 'Responsáveis' },
  { value: 'dueDate',     label: 'Prazo' },
  { value: 'progress',    label: 'Progresso (%)' },
  { value: 'description', label: 'Descrição' },
  { value: 'rating',      label: 'Avaliação ⭐' },
]

const GROUP_BY_OPTIONS = [
  { value: 'group',    label: 'Grupo de tarefas' },
  { value: 'status',   label: 'Status' },
  { value: 'assignee', label: 'Responsável' },
  { value: null,       label: 'Sem agrupamento' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export function ViewWizard({ onClose, onDone, initialType }: ViewWizardProps) {
  const [step, setStep] = useState(initialType ? 1 : 0)
  const [selectedType, setSelectedType] = useState<ViewType | null>(initialType || null)
  const [viewName, setViewName] = useState('')

  // Kanban config
  const [kanbanCardFields, setKanbanCardFields] = useState<string[]>(['assignees', 'dueDate', 'progress'])

  // Calendar config
  const [calDateField, setCalDateField] = useState<string>('dueDate')
  const [calColorBy, setCalColorBy] = useState<string>('status')

  // Gantt config
  const [ganttStartField, setGanttStartField] = useState<string>('dueDate')
  const [ganttEndField, setGanttEndField] = useState<string | null>(null)
  const [ganttGroupBy, setGanttGroupBy] = useState<string | null>('group')

  const meta = selectedType ? VIEW_TYPE_META[selectedType] : null
  const maxSteps = meta ? meta.wizardSteps + 1 : 1 // +1 para o passo de nome/confirmação

  function handleSelectType(type: ViewType) {
    setSelectedType(type)
    setViewName(VIEW_TYPE_META[type].label)
    setStep(1)
  }

  function handleBack() {
    if (step === 1 && !initialType) {
      setStep(0)
      setSelectedType(null)
    } else {
      setStep((s) => s - 1)
    }
  }

  function handleNext() {
    setStep((s) => s + 1)
  }

  function handleFinish() {
    if (!selectedType) return
    let config: Record<string, unknown> = {}

    if (selectedType === 'kanban') {
      const c: KanbanConfig = { statusField: 'status', cardFields: kanbanCardFields as any }
      config = c as Record<string, unknown>
    } else if (selectedType === 'calendar') {
      const c: CalendarConfig = { dateField: calDateField as any, colorByField: calColorBy as any }
      config = c as Record<string, unknown>
    } else if (selectedType === 'gantt') {
      const c: GanttConfig = {
        startField: ganttStartField as any,
        endField: ganttEndField as any,
        groupByField: ganttGroupBy as any,
      }
      config = c as Record<string, unknown>
    }

    onDone(selectedType, viewName || VIEW_TYPE_META[selectedType].label, config)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-base">
              {step === 0 ? 'Adicionar view' : `Configurar ${meta?.label || ''}`}
            </h2>
            {step > 0 && meta && (
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Indicador de passos */}
        {step > 0 && meta && meta.wizardSteps > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-muted/30">
            {Array.from({ length: maxSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < step ? 'bg-primary' : i === step - 1 ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
            <span className="text-[11px] text-muted-foreground ml-1 shrink-0">
              {step}/{maxSteps}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Passo 0: escolha de tipo */}
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Escolha o tipo de visualização para adicionar ao workspace.
              </p>
              {CONFIGURABLE_VIEW_TYPES.map((type) => {
                const m = VIEW_TYPE_META[type]
                const Icon = ICON_MAP[m.icon]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectType(type)}
                    className="w-full flex items-start gap-3 rounded-lg border p-3.5 text-left hover:bg-muted/40 hover:border-primary/40 transition-colors group"
                  >
                    <div className="rounded-md bg-muted p-2 group-hover:bg-primary/10 transition-colors">
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto self-center shrink-0" />
                  </button>
                )
              })}
            </div>
          )}

          {/* ── KANBAN ── */}
          {step === 1 && selectedType === 'kanban' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-1">Colunas do Kanban</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  As colunas são geradas automaticamente a partir dos status das suas tarefas.
                  Você verá: Planejando · Em andamento · Aguardando · Travado · Concluído · Cancelado.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['Planejando', 'Em andamento', 'Aguardando', 'Travado', 'Concluído', 'Cancelado'].map((col) => (
                    <span key={col} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      <Check className="h-3 w-3 text-emerald-500" /> {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'kanban' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-1">Campos no card</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Escolha quais informações aparecem em cada card do Kanban.
                </p>
                <div className="space-y-2">
                  {CARD_FIELD_OPTIONS.map((opt) => {
                    const active = kanbanCardFields.includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          active ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={active}
                          onChange={() =>
                            setKanbanCardFields((prev) =>
                              active ? prev.filter((f) => f !== opt.value) : [...prev, opt.value]
                            )
                          }
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── CALENDÁRIO ── */}
          {step === 1 && selectedType === 'calendar' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Campo de data</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Qual data define onde cada tarefa aparece no calendário?
                </p>
                <div className="space-y-2">
                  {DATE_FIELD_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        calDateField === opt.value ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="calDateField"
                        className="accent-primary"
                        checked={calDateField === opt.value}
                        onChange={() => setCalDateField(opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'calendar' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Cor dos eventos</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Como os eventos serão coloridos no calendário?
                </p>
                <div className="space-y-2">
                  {COLOR_BY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        calColorBy === opt.value ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="calColorBy"
                        className="accent-primary"
                        checked={calColorBy === opt.value}
                        onChange={() => setCalColorBy(opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── GANTT ── */}
          {step === 1 && selectedType === 'gantt' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Data de início das barras</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Qual campo define onde cada barra começa na linha do tempo?
                </p>
                <div className="space-y-2">
                  {DATE_FIELD_OPTIONS.slice(0, 2).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        ganttStartField === opt.value ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ganttStart"
                        className="accent-primary"
                        checked={ganttStartField === opt.value}
                        onChange={() => setGanttStartField(opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'gantt' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Data de fim (opcional)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Se definido, as barras terão extensão. Sem fim, aparecem como marcos pontuais.
                </p>
                <div className="space-y-2">
                  {[...DATE_FIELD_OPTIONS.slice(0, 2), { value: null, label: 'Sem data de fim (marco pontual)' }].map((opt) => (
                    <label
                      key={String(opt.value)}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        ganttEndField === opt.value ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ganttEnd"
                        className="accent-primary"
                        checked={ganttEndField === opt.value}
                        onChange={() => setGanttEndField(opt.value as string | null)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && selectedType === 'gantt' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Agrupar por</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Como as tarefas serão agrupadas na linha do tempo?
                </p>
                <div className="space-y-2">
                  {GROUP_BY_OPTIONS.map((opt) => (
                    <label
                      key={String(opt.value)}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        ganttGroupBy === opt.value ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ganttGroup"
                        className="accent-primary"
                        checked={ganttGroupBy === opt.value}
                        onChange={() => setGanttGroupBy(opt.value as string | null)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Último passo: nome da view */}
          {step === maxSteps && selectedType && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Nome da view</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Você pode personalizar o nome que aparecerá na aba.
                </p>
                <Label htmlFor="view-name">Nome</Label>
                <Input
                  id="view-name"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder={VIEW_TYPE_META[selectedType].label}
                  className="mt-1"
                  autoFocus
                />
              </div>

              {/* Resumo da configuração */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo</div>
                {selectedType === 'kanban' && (
                  <>
                    <SummaryRow label="Colunas" value="Por status (6 colunas automáticas)" />
                    <SummaryRow label="Campos no card" value={kanbanCardFields.map(f => CARD_FIELD_OPTIONS.find(o => o.value === f)?.label || f).join(', ') || 'Nenhum'} />
                  </>
                )}
                {selectedType === 'calendar' && (
                  <>
                    <SummaryRow label="Campo de data" value={DATE_FIELD_OPTIONS.find(o => o.value === calDateField)?.label || calDateField} />
                    <SummaryRow label="Cor dos eventos" value={COLOR_BY_OPTIONS.find(o => o.value === calColorBy)?.label || calColorBy} />
                  </>
                )}
                {selectedType === 'gantt' && (
                  <>
                    <SummaryRow label="Início das barras" value={DATE_FIELD_OPTIONS.find(o => o.value === ganttStartField)?.label || ganttStartField} />
                    <SummaryRow label="Fim das barras" value={DATE_FIELD_OPTIONS.find(o => o.value === ganttEndField)?.label || 'Marco pontual'} />
                    <SummaryRow label="Agrupamento" value={GROUP_BY_OPTIONS.find(o => o.value === ganttGroupBy)?.label || 'Sem agrupamento'} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={handleBack} type="button">
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < maxSteps ? (
              <Button size="sm" onClick={handleNext} type="button">
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish} type="button" disabled={!viewName.trim()}>
                <Check className="h-4 w-4 mr-1" /> Adicionar view
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground min-w-[100px] shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
