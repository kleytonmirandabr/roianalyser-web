/**
 * Admin → Tipos Financeiros (Sprint #231).
 *
 * Read-only. Os 2 tipos (INCOME / EXPENSE) são fixos do sistema e governam
 * o sinal das entradas no cálculo do ROI. Não são editáveis nem deletáveis.
 */
import { ArrowDownCircle, ArrowUpCircle, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { Card } from '@/shared/ui/card'

const TYPES = [
  {
    key: 'INCOME',
    name: 'Entrada',
    nameEn: 'Income',
    nameEs: 'Entrada',
    sign: '+',
    desc: 'Receitas — somam no fluxo de caixa do ROI.',
    descEn: 'Revenues — add to the cash flow.',
    descEs: 'Ingresos — suman al flujo de caja.',
    color: 'emerald',
    Icon: ArrowUpCircle,
  },
  {
    key: 'EXPENSE',
    name: 'Saída',
    nameEn: 'Expense',
    nameEs: 'Salida',
    sign: '−',
    desc: 'Custos e investimentos — subtraem no fluxo de caixa do ROI.',
    descEn: 'Costs and investments — subtract from the cash flow.',
    descEs: 'Costos e inversiones — restan del flujo de caja.',
    color: 'rose',
    Icon: ArrowDownCircle,
  },
] as const

export function AdminFinancialTypesPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const lang = i18n.language?.startsWith('en') ? 'en' : i18n.language?.startsWith('es') ? 'es' : 'pt'
  const nameKey = lang === 'en' ? 'nameEn' : lang === 'es' ? 'nameEs' : 'name'
  const descKey = lang === 'en' ? 'descEn' : lang === 'es' ? 'descEs' : 'desc'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.adminFinancialTypes')}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === 'en'
            ? 'Fixed system types that determine the sign of entries in the ROI calculation.'
            : lang === 'es'
            ? 'Tipos fijos del sistema que determinan el signo de las entradas en el cálculo del ROI.'
            : 'Tipos fixos do sistema que determinam o sinal das entradas no cálculo do ROI.'}
        </p>
      </div>

      <Card className="flex items-start gap-3 border-blue-200/60 bg-blue-50/40 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
        <p className="text-xs text-muted-foreground">
          {lang === 'en'
            ? 'These two types are hard-coded and cannot be created, edited or deleted. Each catalog item must reference one of them via the Behavior field. Any change here would silently break ROI math, so the surface is read-only by design.'
            : lang === 'es'
            ? 'Estos dos tipos son fijos del sistema y no pueden crearse, editarse ni eliminarse. Cada elemento del catálogo debe hacer referencia a uno de ellos mediante el campo Comportamiento. Cualquier cambio aquí rompería silenciosamente el cálculo del ROI, por eso la pantalla es de solo lectura.'
            : 'Estes dois tipos são fixos do sistema e não podem ser criados, editados ou removidos. Cada item de catálogo deve referenciar um deles via o campo Comportamento. Qualquer mudança aqui quebraria silenciosamente o cálculo do ROI, então a tela é read-only por design.'}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPES.map((it) => {
          const tones: Record<string, string> = {
            emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
            rose: 'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
          }
          const Icon = it.Icon
          return (
            <Card key={it.key} className={`flex flex-col gap-2 border p-4 ${tones[it.color]}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="font-mono text-xs uppercase opacity-70">{it.key}</span>
                </div>
                <span className="text-2xl font-bold tabular-nums opacity-80">{it.sign}</span>
              </div>
              <div className="text-lg font-semibold">{it[nameKey as 'name' | 'nameEn' | 'nameEs']}</div>
              <p className="text-xs leading-snug opacity-80">{it[descKey as 'desc' | 'descEn' | 'descEs']}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
