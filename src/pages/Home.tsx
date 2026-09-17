import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  History,
  Inbox,
  ListTodo,
  NotebookPen,
  Pencil,
  PlusCircle,
  RotateCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityType, Entry } from '../types'
import { fmtDateTime, percentDone, todayKey } from '../lib/format'
import { KIND_META, PRIORITY_ORDER, PROJECT_COLOR_CLASS } from '../lib/constants'
import { useEntries, useProjects, useActivities } from '../lib/data'
import QuickAdd from '../components/QuickAdd'
import EntryCard from '../components/EntryCard'
import DetailModal from '../components/DetailModal'
import EmptyState from '../components/EmptyState'

const ACTIVITY_META: Record<ActivityType, { label: string; icon: LucideIcon; color: string }> = {
  add: { label: 'إضافة', icon: PlusCircle, color: 'text-emerald-500' },
  complete: { label: 'إكمال مهمة', icon: CheckCircle2, color: 'text-emerald-600' },
  reopen: { label: 'إعادة فتح', icon: RotateCcw, color: 'text-slate-500' },
  status: { label: 'تغيير حالة', icon: ListTodo, color: 'text-sky-500' },
  edit: { label: 'تعديل', icon: Pencil, color: 'text-slate-400' },
}

function SectionHeading({
  icon: Icon,
  title,
  iconColor,
  count,
  to,
  linkLabel,
}: {
  icon: LucideIcon
  title: string
  iconColor: string
  count?: number
  to?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-bold text-slate-800">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        {title}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {count}
          </span>
        )}
      </h2>
      {to && (
        <Link to={to} className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700">
          {linkLabel ?? 'عرض الكل'}
        </Link>
      )}
    </div>
  )
}

const byPriority = (a: Entry, b: Entry) =>
  (PRIORITY_ORDER[b.priority] ?? 1) - (PRIORITY_ORDER[a.priority] ?? 1) ||
  (a.createdAt < b.createdAt ? 1 : -1)

export default function Home() {
  const { data: entries = [], error: entriesError } = useEntries({ limit: 500 })
  const { data: projects = [] } = useProjects()
  const { data: activities = [] } = useActivities({ limit: 10 })
  const [openId, setOpenId] = useState<string | null>(null)

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  const tasks = entries.filter((e) => e.kind === 'task')
  const pendingTasks = tasks.filter((e) => e.status !== 'done')
  const notes = entries.filter((e) => e.kind !== 'task')
  const today = todayKey()

  const urgentCount = pendingTasks.filter((e) => e.priority === 'urgent').length
  const importantCount = pendingTasks.filter((e) => e.priority === 'important').length
  const normalCount = pendingTasks.filter((e) => e.priority === 'normal').length
  const inProgressCount = pendingTasks.filter((e) => e.status === 'in_progress').length

  const lateTasks = pendingTasks
    .filter((e) => e.dueDate && e.dueDate < today)
    .sort(byPriority)
  const todayTasks = pendingTasks
    .filter((e) => e.dueDate === today)
    .sort(byPriority)
  const openTasks = pendingTasks
    .filter((e) => !e.dueDate || e.dueDate > today)
    .sort(byPriority)

  const recentNotes = notes.slice(0, 5)

  const projectStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number; pending: number }>()
    for (const e of entries) {
      if (e.kind !== 'task' || e.projectId == null) continue
      const s = map.get(e.projectId) ?? { total: 0, done: 0, pending: 0 }
      s.total += 1
      if (e.status === 'done') s.done += 1
      else s.pending += 1
      map.set(e.projectId, s)
    }
    return map
  }, [entries])

  const activeProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    )
    const withPending = sorted.filter((p) => (projectStats.get(p.id)?.pending ?? 0) > 0)
    const rest = sorted.filter((p) => (projectStats.get(p.id)?.pending ?? 0) === 0)
    return [...withPending, ...rest].slice(0, 4)
  }, [projects, projectStats])

  const stats = [
    { label: 'عاجلة', value: urgentCount, dot: 'bg-red-500' },
    { label: 'مهمة', value: importantCount, dot: 'bg-amber-500' },
    { label: 'عادية', value: normalCount, dot: 'bg-emerald-500' },
    { label: 'متأخرة', value: lateTasks.length, dot: 'bg-red-600' },
    { label: 'قيد التنفيذ', value: inProgressCount, dot: 'bg-sky-500' },
  ]

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {stats.map((s) => (
          <div
            key={s.label}
            className="card flex w-[86px] shrink-0 flex-col items-center gap-1 p-3"
          >
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className="text-xl font-bold leading-none text-slate-800">{s.value}</span>
            <span className="text-[11px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {entriesError && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {entriesError}
        </p>
      )}

      <div className="mt-4">
        <QuickAdd />
      </div>

      <section className="mt-7">
        <SectionHeading
          icon={CalendarClock}
          title="مهام اليوم"
          iconColor="text-brand-600"
          count={todayTasks.length}
        />
        <div className="mt-3 space-y-3">
          {todayTasks.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              project={projectMap.get(e.projectId ?? '') ?? null}
              onOpen={() => setOpenId(e.id)}
            />
          ))}
          {todayTasks.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="لا توجد مهام مستحقة اليوم"
              hint="أضف مهمة من الأعلى أو من صفحة المهام"
            />
          )}
        </div>
      </section>

      {lateTasks.length > 0 && (
        <section className="mt-7">
          <SectionHeading
            icon={AlertTriangle}
            title="مهام متأخرة"
            iconColor="text-red-500"
            count={lateTasks.length}
            to="/tasks"
          />
          <div className="mt-3 space-y-3">
            {lateTasks.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                project={projectMap.get(e.projectId ?? '') ?? null}
                onOpen={() => setOpenId(e.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        <SectionHeading
          icon={Inbox}
          title="مهام قيد المتابعة"
          iconColor="text-sky-500"
          count={openTasks.length}
          to="/tasks"
        />
        <div className="mt-3 space-y-3">
          {openTasks.length > 0 && (
            <p className="text-xs text-slate-400">
              مهام مفتوحة بدون موعد أو بموعد قادم — لا تعدّ متأخرة.
            </p>
          )}
          {openTasks.slice(0, 8).map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              project={projectMap.get(e.projectId ?? '') ?? null}
              onOpen={() => setOpenId(e.id)}
            />
          ))}
          {openTasks.length > 8 && (
            <Link
              to="/tasks"
              className="block text-center text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              عرض جميع المهام المفتوحة
            </Link>
          )}
          {openTasks.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="لا توجد مهام مفتوحة"
              hint="كل المهام منجزة أو مستحقة اليوم"
            />
          )}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading
          icon={NotebookPen}
          title="آخر الملاحظات"
          iconColor="text-sky-500"
          to="/notes"
          linkLabel="عرض جميع الملاحظات"
        />
        <div className="mt-3 space-y-3">
          {recentNotes.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              project={projectMap.get(e.projectId ?? '') ?? null}
              onOpen={() => setOpenId(e.id)}
            />
          ))}
          {recentNotes.length === 0 && (
            <EmptyState
              icon={NotebookPen}
              title="لا توجد ملاحظات بعد"
              hint="سجِّل أي ملاحظة أو توجيه بمجرد كتابته وحفظه"
            />
          )}
        </div>
      </section>

      {activities.length > 0 && (
        <section className="mt-7">
          <SectionHeading icon={History} title="آخر النشاطات" iconColor="text-slate-500" />
          <div className="card mt-3 divide-y divide-slate-100 px-4 py-2">
            {activities.map((a) => {
              const meta = ACTIVITY_META[a.type]
              const Icon = meta.icon
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (a.entryId != null) setOpenId(a.entryId)
                  }}
                  className="flex w-full items-center gap-2.5 py-2.5 text-start"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-500">
                      {meta.label} {a.kind ? KIND_META[a.kind].label : ''}
                    </span>
                    <p className="truncate text-sm text-slate-700">{a.text}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {fmtDateTime(a.createdAt)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="mt-7">
          <SectionHeading
            icon={FolderKanban}
            title="المشاريع الحالية"
            iconColor="text-emerald-600"
            to="/projects"
          />
          <div className="mt-3 space-y-2">
            {activeProjects.map((p) => {
              const s = projectStats.get(p.id) ?? { total: 0, done: 0 }
              const pct = percentDone(s.done, s.total)
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="card flex items-center gap-3 p-3.5 transition hover:shadow-md"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${PROJECT_COLOR_CLASS[p.color ?? 'violet']}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                      <span className="shrink-0 text-xs text-slate-400">
                        {s.done}/{s.total} مهام
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${PROJECT_COLOR_CLASS[p.color ?? 'violet']}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}