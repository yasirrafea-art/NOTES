import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen } from 'lucide-react'
import type { EntryKind } from '../types'
import { db } from '../db'
import { KIND_OPTIONS } from '../lib/constants'
import QuickAdd from '../components/QuickAdd'
import EntryCard from '../components/EntryCard'
import DetailModal from '../components/DetailModal'
import EmptyState from '../components/EmptyState'

export default function Notes() {
  const entries = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []) ?? []
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const [tab, setTab] = useState<EntryKind | 'all'>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id as number, p])), [projects])

  const notes = entries.filter((e) => e.kind !== 'task')
  const filtered = notes.filter((e) => tab === 'all' || e.kind === tab)

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-slate-800">الملاحظات والتوجيهات</h1>
      <QuickAdd defaultKind={tab === 'all' ? 'note' : tab} subtitle="تُحفظ تلقائيًا بالتاريخ والوقت" />

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {[{ value: 'all' as const, label: 'الكل' }, ...KIND_OPTIONS.filter((o) => o.value !== 'task')].map(
          ({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                tab === value
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
          <EmptyState
            icon={NotebookPen}
            title="لا توجد سجلات هنا"
            hint="اكتب ما قاله المدير أو أي ملاحظة بسرعة"
          />
        )}
      </div>

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}