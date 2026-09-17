import type { EntryKind, Priority, TaskStatus } from '../types'
import { KIND_META, PRIORITY_META, STATUS_META } from '../lib/constants'

export function KindBadge({ kind }: { kind: EntryKind }) {
  const m = KIND_META[kind]
  const Icon = m.icon
  return (
    <span className={`chip ${m.chip}`}>
      <Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority]
  return <span className={`chip ${m.chip}`}>{m.label}</span>
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status]
  return <span className={`chip ${m.chip}`}>{m.label}</span>
}