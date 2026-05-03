import { GripVertical } from 'lucide-react'
import { type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  id: string
  children: (drag: ReactNode) => ReactNode
  disabled?: boolean
}

export function SortableRow({ id, children, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
  }
  const handle = !disabled ? (
    <div
      {...attributes} {...listeners}
      className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors"
      style={{ touchAction: 'none' }}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </div>
  ) : <div />

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  )
}
