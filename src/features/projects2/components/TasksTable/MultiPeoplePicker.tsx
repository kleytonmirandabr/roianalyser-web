import { useEffect, useRef, useState } from 'react'
import { UserCircle2 } from 'lucide-react'
import { initials } from './helpers'
import type { UserMini } from './types'

interface Props {
  value: string[]
  users: UserMini[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function MultiPeoplePicker({ value, users, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered  = users.filter(u => !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()))
  const selected  = users.filter(u => value.includes(u.id))

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-1 min-h-[28px] px-1 rounded hover:bg-muted/40 transition-colors disabled:cursor-not-allowed"
      >
        {selected.length === 0 ? (
          <UserCircle2 className="h-5 w-5 text-muted-foreground/40" />
        ) : selected.slice(0, 3).map(u => (
          <div key={u.id}
            className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0"
            title={u.name}>
            {initials(u.name)}
          </div>
        ))}
        {selected.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{selected.length - 3}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 max-h-56 rounded-md border bg-popover shadow-lg overflow-auto">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full text-xs px-2 py-1 rounded border bg-background outline-none"
            />
          </div>
          <ul className="py-1">
            {filtered.map(u => {
              const sel = value.includes(u.id)
              return (
                <li key={u.id}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer ${sel ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => onChange(sel ? value.filter(id => id !== u.id) : [...value, u.id])}
                >
                  <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                    {initials(u.name)}
                  </div>
                  <span className="truncate">{u.name}</span>
                  {sel && <span className="ml-auto text-primary text-[10px]">✓</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
