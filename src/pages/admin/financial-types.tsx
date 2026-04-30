/**
 * Admin → Tipos Financeiros (Sprint #231 + i18n #234).
 *
 * Read-only. Os 2 tipos (INCOME / EXPENSE) são fixos do sistema e governam
 * o sinal das entradas no cálculo do ROI. Não são editáveis nem deletáveis.
 */
import { ArrowDownCircle, ArrowUpCircle, Info, TrendingDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { Card } from '@/shared/ui/card'

const TYPES = [
  { key: 'INCOME',     sign: '+', color: 'emerald', Icon: ArrowUpCircle },
  { key: 'EXPENSE',    sign: '−', color: 'rose',    Icon: ArrowDownCircle },
  { key: 'INVESTMENT', sign: '−', color: 'blue',    Icon: TrendingDown },
] as const

export function AdminFinancialTypesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.adminFinancialTypes')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.financialTypes.pageSubtitle')}</p>
      </div>

      <Card className="flex items-start gap-3 border-blue-200/60 bg-blue-50/40 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
        <p className="text-xs text-muted-foreground">{t('admin.financialTypes.banner')}</p>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TYPES.map((it) => {
          const tones: Record<string, string> = {
            emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
            rose:    'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
            blue:    'border-blue-200 bg-blue-50/60 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
          }
          const Icon = it.Icon
          const nameKey = it.key === 'INCOME' ? 'income' : it.key === 'INVESTMENT' ? 'investment' : 'expense'
          const descKey = it.key === 'INCOME' ? 'incomeDesc' : it.key === 'INVESTMENT' ? 'investmentDesc' : 'expenseDesc'
          return (
            <Card key={it.key} className={`flex flex-col gap-2 border p-4 ${tones[it.color]}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="font-mono text-xs uppercase opacity-70">{it.key}</span>
                </div>
                <span className="text-2xl font-bold tabular-nums opacity-80">{it.sign}</span>
              </div>
              <div className="text-lg font-semibold">{t(`admin.financialTypes.${nameKey}`)}</div>
              <p className="text-xs leading-snug opacity-80">{t(`admin.financialTypes.${descKey}`)}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
