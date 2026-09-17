import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Circle, FolderOpen, ListTodo, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { nowISO, percentDone } from '../lib/format'
import { PROJECT_COLORS, PROJECT_COLOR_CLASS } from '../lib/constants'
import QuickAdd from '../components/QuickAdd'
import EntryCard from '../components/EntryCard'
import DetailModal from '../components/DetailModal'
import AttachmentSection from '../components/AttachmentSection'
import EmptyState from '../components/EmptyState'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const projectId = Number(id)
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const entries = useLiveQuery(
    () => db.entries.where('projectId').equals(projectId).toArray(),
    [projectId],
  )
  const [openId, setOpenId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState('violet')

  const list = useMemo(() => {
    const arr = entries ?? []
    return [...arr].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [entries])

  const taskList = list.filter((e) => e.kind === 'task')
  const noteList = list.filter((e) => e.kind !== 'task')
  const doneCount = taskList.filter((e) => e.status === 'done').length
  const pct = percentDone(doneCount, taskList.length)

  if (!project) {
    return (
      <EmptyState icon={FolderOpen} title="المشروع غير موجود" hint="ربما تم حذفه أو أن الرابط غير صحيح" />
    )
  }

  const current = project

  function startEdit() {
    setName(current.name)
    setDesc(current.description ?? '')
    setColor(current.color ?? 'violet')
    setEditing(true)
  }

  async function saveEdit() {
    if (!name.trim()) return
    await db.projects.update(projectId, {
      name: name.trim(),
      description: desc.trim() || undefined,
      color,
      updatedAt: nowISO(),
    })
    setEditing(false)
  }

  async function remove() {
    if (!window.confirm('حذف المشروع؟ ستبقى سجلاته لكن بدون ربط بالمشروع.')) return
    await db.entries.where('projectId').equals(projectId).modify((e) => {
      e.projectId = null
    })
    await db.attachments.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
    navigate('/projects')
  }

  return (
    <div>
      <div className="card p-5">
        {editing ? (
          <div>
            <div className="flex gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${PROJECT_COLOR_CLASS[c]} transition ${
                    color === c ? 'ring-2 ring-brand-500 ring-offset-2' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-3" placeholder="اسم المشروع" />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="input mt-2 resize-none"
              placeholder="وصف المشروع (اختياري)"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => void saveEdit()} className="btn-primary">
                حفظ
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${PROJECT_COLOR_CLASS[project.color ?? 'violet']}`} />
              <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-800">{project.name}</h1>
            </div>
            {project.description && (
              <p className="mt-1.5 text-sm text-slate-500">{project.description}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${PROJECT_COLOR_CLASS[project.color ?? 'violet']}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-600">{pct}% مكتمل</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={startEdit} className="btn-ghost">
                <Pencil className="h-4 w-4" />
                تعديل
              </button>
              <button
                onClick={() => void remove()}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                حذف المشروع
              </button>
              <div className="ms-auto flex -space-x-2">
                <span className="chip bg-violet-100 text-violet-700">
                  <ListTodo className="h-3.5 w-3.5" />
                  {taskList.length} مهام
                </span>
                <span className="chip ms-2 bg-sky-100 text-sky-700">
                  <NotebookPen className="h-3.5 w-3.5" />
                  {noteList.length} سجلات
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <QuickAdd defaultKind="task" defaultProjectId={projectId} title="إضافة مهمة للمشروع" />
      </div>

      <section className="mt-6">
        <h2 className="font-bold text-slate-800">مهام المشروع</h2>
        <div className="mt-3 space-y-3">
          {taskList.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onOpen={() => setOpenId(e.id!)}
            />
          ))}
          {taskList.length === 0 && (
            <EmptyState icon={ListTodo} title="لا توجد مهام بعد" hint="أضف مهمة للمشروع من الأعلى" />
          )}
        </div>
      </section>

      {noteList.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold text-slate-800">ملاحظات وتوجيهات المشروع</h2>
          <div className="mt-3 space-y-3">
            {noteList.map((e) => (
              <EntryCard key={e.id} entry={e} onOpen={() => setOpenId(e.id!)} />
            ))}
          </div>
        </section>
      )}

      <section className="card mt-8 p-4">
        <h2 className="font-semibold text-slate-800">مرفقات المشروع</h2>
        <AttachmentSection projectId={projectId} />
        <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
          {doneCount === taskList.length && taskList.length > 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              اكتملت جميع مهام المشروع
            </>
          ) : (
            <>
              <Circle className="h-4 w-4" />
              {doneCount} من {taskList.length} مهام مكتملة
            </>
          )}
        </div>
      </section>

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}