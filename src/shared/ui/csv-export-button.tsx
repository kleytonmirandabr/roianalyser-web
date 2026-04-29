/**
 * Botão reusável "Exportar CSV" — Sprint #199.
 *
 * Exemplo:
 *   <CsvExportButton
 *     filename="oportunidades"
 *     columns={[
 *       { key: 'name', label: 'Nome', getValue: (r) => r.name },
 *       { key: 'value', label: 'Valor', getValue: (r) => r.estimatedValue },
 *     ]}
 *     rows={filteredItems}
 *   />
 */
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { downloadCsv, type CsvColumn } from '@/shared/lib/csv-export'
import { Button } from '@/shared/ui/button'

interface Props<T> {
  filename: string
  columns: CsvColumn<T>[]
  rows: T[]
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  disabled?: boolean
  className?: string
}

export function CsvExportButton<T>({
  filename, columns, rows, size = 'sm', variant = 'outline', disabled, className,
}: Props<T>) {
  const { t, i18n } = useTranslation()
  const label = t('common.exportCsv', 'Exportar CSV')
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv({ filename, columns, rows, locale: i18n.language })}
      className={className}
      title={`${label} (${rows.length})`}
    >
      <Download className="h-4 w-4 mr-1" /> {label}
    </Button>
  )
}
