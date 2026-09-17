import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Trash2, X } from 'lucide-react'
import { db } from '../db'
import { fmtDateTime, nowISO } from '../lib/format'
import { KIND_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../lib/constants'
import { logActivity } from '../lib/activity'
import type { ActivityType, EntryKind, Priority, TaskStatus } from '../types'
import AttachmentSection from './AttachmentSection'

interface Props {
  entryId: number
  onClose: () => void
}

export default function DetailModal({ entryId, onClose }: Props) {
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId])
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<EntryKind>('task')
  const [priority, setPriority] = useState<Priority>('normal')
  const [status, setStatus] = useState<TaskStatus>('not_started')
  const [projectId, setProjectId] = useState<number | ''>('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setText(entry.text)
      setDescription(entry.description ?? '')
      setKind(entry.kind)
      setPriority(entry.priority)
      setStatus(entry.status ?? 'not_started')
      setProjectId(entry.projectId ?? '')
      setDueDate(entry.dueDate ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id])

  if (!entry) return null

  const project = projects.find((p) => p.id === entry.projectId)

  async function save() {
    if (!entry || !text.trim()) return
    setSaving(true)
    const isTask = kind === 'task'
    const isDone = isTask && status === 'done'
    const wasDone = entry.status === 'done'
    const nextProjectId = projectId !== '' ? Number(projectId) : null
    const nextText = text.trim()
    const nextDescription = description.trim() || undefined
    await db.entries.update(entryId, {
      kind,
      text: nextText,
      priority,
      status: isTask ? status : undefined,
      projectId: nextProjectId,
      dueDate: dueDate || null,
      description: nextDescription,
      completedAt: isTask && isDone ? (entry.completedAt ?? nowISO()) : null,
      updatedAt: nowISO(),
    })

    let actType: ActivityType | null = null
    if (isTask && (entry.status ?? null) !== status) {
      actType = isDone ? 'complete' : wasDone ? 'reopen' : 'status'
    } else if (
      nextText !== entry.text ||
      kind !== entry.kind ||
      priority !== entry.priority ||
      nextDescription !== (entry.description ?? undefined) ||
      nextProjectId !== (entry.projectId ?? null) ||
      (dueDate || null) !== (entry.dueDate ?? null)
    ) {
      actType = 'edit'
    }
    if (actType) {
      await logActivity({
        entryId: entryId,
        projectId: nextProjectId,
        type: actType,
        kind: kind,
        text: nextText,
      })
    }
    setSaving(false)
  }

  async function remove() {
    if (!window.confirm('حذف هذا السجل نهائيًا؟')) return
    await db.attachments.where('entryId').equals(entryId).delete()
    await db.entries.delete(entryId)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto my-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">تفاصيل السجل</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">النوع</label>
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    kind === value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">النص</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="input resize-none"
            />
          </div>

          <div>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">الأهمية</label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    priority === value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'task' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">الحالة</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="input"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  موعد (اختياري)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}

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

          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {entry.completedAt ? (
              <p>
                أُضيفت في {fmtDateTime(entry.createdAt)} — أُنجزت في {fmtDateTime(entry.completedAt)}
              </p>
            ) : (
              <p>أُضيفت في {fmtDateTime(entry.createdAt)}</p>
            )}
            {project && <p className="mt-1">المشروع: {project.name}</p>}
          </div>

          <AttachmentSection entryId={entryId} />

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => void remove()}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              حذف
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary ms-auto">
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}