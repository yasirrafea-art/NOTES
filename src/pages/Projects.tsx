import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { percentDone } from '../lib/format'
import { PROJECT_COLORS, PROJECT_COLOR_CLASS } from '../lib/constants'
import { api, CONNECTION_ERROR } from '../lib/api'
import { useEntries, useProjects } from '../lib/data'
import EmptyState from '../components/EmptyState'

export default function Projects() {
  const { data: projects = [] } = useProjects()
  const { data: entries = [] } = useEntries({ limit: 1000 })
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState<string>('violet')
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; done: number }
    >()
    for (const e of entries) {
      if (e.kind !== 'task' || e.projectId == null) continue
      const s = map.get(e.projectId) ?? { total: 0, done: 0 }
      s.total += 1
      if (e.status === 'done') s.done += 1
      map.set(e.projectId, s)
    }
    return map
  }, [entries])

  async function create() {
    const n = name.trim()
    if (!n) return
    setError(null)
    try {
      await api.addProject({
        name: n,
        description: desc.trim() || null,
        color,
      })
      setName('')
      setDesc('')
    } catch (err) {
      console.error('[دفتر العمل] تعذر إنشاء المشروع:', err)
      setError(err instanceof Error ? err.message : CONNECTION_ERROR)
    }
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-slate-800">المشاريع</h1>

      <div className="card p-4 sm:p-5">
        <h2 className="font-bold text-slate-800">مشروع جديد</h2>
        <p className="mt-1 text-xs text-slate-400">
          المشاريع اختيارية — تُستخدم فقط لتنظيم مجموعة كبيرة من المهام.
        </p>
        <div className="mt-3 flex gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              className={`h-8 w-8 rounded-full ${PROJECT_COLOR_CLASS[c]} transition ${
                color === c ? 'ring-2 ring-brand-500 ring-offset-2' : 'opacity-60 hover:opacity-100'
              }`}
            />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
          placeholder="اسم المشروع..."
          className="input mt-3"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          placeholder="وصف المشروع (اختياري)"
          className="input mt-2 resize-none"
        />
        <button onClick={() => void create()} disabled={!name.trim()} className="btn-primary mt-3">
          <Plus className="h-4 w-4" />
          إنشاء المشروع
        </button>
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      </div>

      <div className="mt-5 space-y-3">
        {projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="لا توجد مشاريع بعد"
            hint="أنشئ مشروعًا عندما تحتاج تنظيم مجموعة مهام"
          />
        )}
        {projects.map((p) => {
          const id = p.id
          const s = stats.get(id) ?? { total: 0, done: 0 }
          const pct = percentDone(s.done, s.total)
          return (
            <Link
              key={id}
              to={`/projects/${id}`}
              className="card block p-5 transition hover:shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-3 w-3 shrink-0 rounded-full ${PROJECT_COLOR_CLASS[p.color ?? 'violet']}`} />
                <h3 className="min-w-0 flex-1 truncate font-bold text-slate-800">{p.name}</h3>
                <span className="shrink-0 text-xs text-slate-500">
                  {s.done}/{s.total} مهام
                </span>
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description}</p>
              )}
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${PROJECT_COLOR_CLASS[p.color ?? 'violet']}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{pct}% مكتمل</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}