import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react'
import type { TaskStatus } from '../types'
import { db } from '../db'
import { STATUS_OPTIONS } from '../lib/constants'
import QuickAdd from '../components/QuickAdd'
import EntryCard from '../components/EntryCard'
import DetailModal from '../components/DetailModal'
import EmptyState from '../components/EmptyState'

export default function Tasks() {
  const entries = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []) ?? []
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id as number, p])), [projects])

  const tasks = entries.filter((e) => e.kind === 'task')
  const pending = tasks.filter((e) => e.status !== 'done')
  const done = tasks.filter((e) => e.status === 'done')
  const filtered = pending.filter((e) => statusFilter === 'all' || e.status === statusFilter)

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-slate-800">المهام</h1>
      <QuickAdd defaultKind="task" subtitle="الحالة تبدأ افتراضيًا بـ «لم تبدأ»" />

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {[{ value: 'all' as const, label: 'الكل' }, ...STATUS_OPTIONS.filter((s) => s.value !== 'done')].map(
          ({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      <div className="mt-3 space-y-3">
        {filtered.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            project={projectMap.get(e.projectId ?? -1) ?? null}
            onOpen={() => setOpenId(e.id!)}
          />
        ))}
        {filtered.length === 0 && (
          <EmptyState icon={ClipboardCheck} title="لا توجد مهام هنا" hint="اكتب مهمة سريعًا من الأعلى" />
        )}
      </div>

      {done.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-brand-600"
          >
            {showDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            المكتملة ({done.length})
          </button>
          {showDone && (
            <div className="mt-3 space-y-3">
              {done.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  project={projectMap.get(e.projectId ?? -1) ?? null}
                  onOpen={() => setOpenId(e.id!)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}