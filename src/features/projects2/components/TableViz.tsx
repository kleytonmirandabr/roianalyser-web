import type { QueryResult } from '../analytics-types'

interface Props {
  result: QueryResult
}

export function TableViz({ result }: Props) {
  const { columns, rows } = result
  if (!rows.length) return <p className="text-xs text-muted-foreground text-center py-6">Sem dados</p>

  return (
    <div className="overflow-auto max-h-64 text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className="px-2 py-1.5 text-left font-medium border-b bg-muted/50 sticky top-0 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 border-b border-border/30">
              {columns.map(c => (
                <td key={c.key} className="px-2 py-1 max-w-[200px] truncate">
                  {String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
