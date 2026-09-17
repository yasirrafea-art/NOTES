import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Plus, Zap } from 'lucide-react'
import { db } from '../db'
import { KIND_OPTIONS, PRIORITY_OPTIONS } from '../lib/constants'
import { nowISO } from '../lib/format'
import { logActivity } from '../lib/activity'
import type { EntryKind, Priority } from '../types'

interface Props {
  defaultKind?: EntryKind
  defaultProjectId?: number
  title?: string
  subtitle?: string
}

export default function QuickAdd({
  defaultKind = 'task',
  defaultProjectId,
  title = 'إضافة سريعة',
  subtitle,
}: Props) {
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const [text, setText] = useState('')
  const [kind, setKind] = useState<EntryKind>(defaultKind)
  const [priority, setPriority] = useState<Priority>('normal')
  const [showMore, setShowMore] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId ?? '')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  const canSave = text.trim().length > 0

  async function save() {
    const t = text.trim()
    if (!t) return
    const date = nowISO()
    const id = await db.entries.add({
      kind,
      text: t,
      priority,
      status: kind === 'task' ? 'not_started' : undefined,
      projectId: projectId !== '' ? Number(projectId) : null,
      dueDate: kind === 'task' ? dueDate || null : null,
      description: description.trim() || undefined,
      createdAt: date,
      completedAt: null,
      updatedAt: date,
    })
    await logActivity({
      entryId: id,
      projectId: projectId !== '' ? Number(projectId) : null,
      type: 'add',
      kind,
      text: t,
    })
    setText('')
    setDueDate('')
    setDescription('')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-bold text-slate-800">
          <Zap className="h-4 w-4 text-brand-600" />
          {title}
        </h2>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void save()
          }
        }}
        rows={2}
        placeholder="اكتب المهمة أو الملاحظة..."
        className="input mt-3 resize-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {KIND_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              kind === value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PRIORITY_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPriority(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              priority === value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === 'task' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-brand-600"
          >
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            خيارات إضافية (اختيارية)
          </button>
          {showMore && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  موعد التنفيذ (اختياري)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  المشروع (اختياري)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="input"
                >
                  <option value="">بدون مشروع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  وصف إضافي (اختياري)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="أي تفاصيل إضافية..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => void save()} disabled={!canSave} className="btn-primary">
          <Plus className="h-4 w-4" />
          حفظ
        </button>
        {saved && <span className="text-sm font-medium text-emerald-600">تم الحفظ ✓</span>}
      </div>
    </section>
  )
}