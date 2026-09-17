import { ListTodo, NotebookPen, Megaphone, Handshake } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EntryKind, Priority, TaskStatus } from '../types'

export const KIND_META: Record<EntryKind, { label: string; icon: LucideIcon; chip: string; dot: string }> = {
  task: { label: 'مهمة', icon: ListTodo, chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  note: { label: 'ملاحظة', icon: NotebookPen, chip: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  directive: { label: 'توجيه', icon: Megaphone, chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  agreement: { label: 'اتفاق', icon: Handshake, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

export const KIND_OPTIONS: { value: EntryKind; label: string; icon: LucideIcon; chip: string; dot: string }[] = (
  Object.keys(KIND_META) as EntryKind[]
).map((k) => ({ value: k, ...KIND_META[k] }))

export const PRIORITY_META: Record<Priority, { label: string; chip: string }> = {
  normal: { label: 'عادية', chip: 'bg-slate-100 text-slate-600' },
  important: { label: 'مهمة', chip: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'عاجلة', chip: 'bg-red-100 text-red-700' },
}

export const PRIORITY_OPTIONS: { value: Priority; label: string; chip: string }[] = (
  Object.keys(PRIORITY_META) as Priority[]
).map((p) => ({ value: p, ...PRIORITY_META[p] }))

export const STATUS_META: Record<TaskStatus, { label: string; chip: string }> = {
  not_started: { label: 'لم تبدأ', chip: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'قيد التنفيذ', chip: 'bg-sky-100 text-sky-700' },
  done: { label: 'تمت', chip: 'bg-emerald-100 text-emerald-700' },
  postponed: { label: 'مؤجلة', chip: 'bg-amber-100 text-amber-800' },
}

export const STATUS_OPTIONS: { value: TaskStatus; label: string; chip: string }[] = (
  Object.keys(STATUS_META) as TaskStatus[]
).map((s) => ({ value: s, ...STATUS_META[s] }))

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 3,
  important: 2,
  normal: 1,
}

export const PROJECT_COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'slate'] as const

export const PROJECT_COLOR_CLASS: Record<string, string> = {
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
}