import { Check } from 'lucide-react'
import type { Entry, Project } from '../types'
import { dueLabel, fmtDateTime, nowISO, overdueText } from '../lib/format'
import { PROJECT_COLOR_CLASS } from '../lib/constants'
import { logActivity } from '../lib/activity'
import { api } from '../lib/api'
import { KindBadge, PriorityBadge, StatusBadge } from './Badges'

interface Props {
  entry: Entry
  project?: Project | null
  onOpen: () => void
}

export default function EntryCard({ entry, project, onOpen }: Props) {
  const isTask = entry.kind === 'task'
  const done = isTask && entry.status === 'done'
  const due = entry.dueDate ? dueLabel(entry.dueDate) : null

  const priorityAccent =
    entry.priority === 'urgent'
      ? 'border-s-4 border-red-400'
      : entry.priority === 'important'
        ? 'border-s-4 border-amber-400'
        : ''

  async function toggleDone() {
    const nextDone = !done
    try {
      await api.updateEntry(entry.id, {
        status: nextDone ? 'done' : 'not_started',
        completedAt: nextDone ? nowISO() : null,
      })
      await logActivity({
        entryId: entry.id,
        projectId: entry.projectId,
        type: nextDone ? 'complete' : 'reopen',
        kind: 'task',
        text: entry.text,
      })
    } catch (err) {
      console.error('[دفتر العمل] تعذر تحديث المهمة:', err)
    }
  }

  return (
    <div
      onClick={onOpen}
      className={`card cursor-pointer p-4 transition hover:shadow-md ${priorityAccent}`}
    >
      <div className="flex gap-3">
        {isTask && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              void toggleDone()
            }}
            title={done ? 'إعادة فتح المهمة' : 'تحديد كـ "تمت"'}
            className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition ${
              done
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-slate-300 text-transparent hover:border-brand-500'
            }`}
          >
            <Check className="h-5 w-5 text-white" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={entry.kind} />
            {isTask && entry.status && <StatusBadge status={entry.status} />}
            {entry.priority !== 'normal' && <PriorityBadge priority={entry.priority} />}
            {due && (
              <span
                className={`chip ${
                  due.state === 'late'
                    ? 'bg-red-100 font-semibold text-red-700'
                    : due.state === 'today'
                      ? 'bg-amber-100 font-semibold text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {due.state === 'late'
                  ? `⚠ ${overdueText(entry.dueDate!)}`
                  : due.state === 'today'
                    ? '⚠ اليوم'
                    : `الموعد: ${due.label}`}
              </span>
            )}
          </div>

          <p
            className={`mt-1.5 leading-relaxed text-slate-800 ${
              done ? 'text-slate-400 line-through' : ''
            }`}
          >
            {entry.text}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{fmtDateTime(entry.createdAt)}</span>
            {project && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <span
                  className={`h-2 w-2 rounded-full ${PROJECT_COLOR_CLASS[project.color ?? 'violet']}`}
                />
                {project.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}