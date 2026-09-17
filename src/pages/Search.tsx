import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, SearchX } from 'lucide-react'
import { percentDone } from '../lib/format'
import { PROJECT_COLOR_CLASS } from '../lib/constants'
import { useEntries, useProjects } from '../lib/data'
import EntryCard from '../components/EntryCard'
import DetailModal from '../components/DetailModal'
import EmptyState from '../components/EmptyState'

function Mark({ text, q }: { text: string; q: string }) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200 px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export default function Search() {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: entries = [] } = useEntries({ limit: 500 })
  const { data: projects = [] } = useProjects()

  const query = q.trim()

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const entryResults = useMemo(() => {
    if (!query) return []
    const needle = query.toLowerCase()
    return entries
      .filter((e) => e.text.toLowerCase().includes(needle) || (e.description ?? '').toLowerCase().includes(needle))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [entries, query])

  const projectResults = useMemo(() => {
    if (!query) return []
    const needle = query.toLowerCase()
    return projects.filter((p) => p.name.toLowerCase().includes(needle))
  }, [projects, query])

  const doneSet = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>()
    for (const e of entries) {
      if (e.kind !== 'task' || e.projectId == null) continue
      const s = m.get(e.projectId) ?? { total: 0, done: 0 }
      s.total += 1
      if (e.status === 'done') s.done += 1
      m.set(e.projectId, s)
    }
    return m
  }, [entries])

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-slate-800">البحث</h1>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في المهام والملاحظات والتوجيهات والاتفاقات والمشاريع..."
          className="input ps-10 py-3"
        />
      </div>

      {!query && (
        <p className="mt-3 text-sm text-slate-400">
          اكتب أي كلمة أو موضوع للعثور على كل ما سجلته عنه: مهام، ملاحظات، توجيهات، اتفاقات،
          ومشاريع.
        </p>
      )}

      {query && projectResults.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-bold text-slate-500">المشاريع ({projectResults.length})</h2>
          <div className="mt-2 space-y-2">
            {projectResults.map((p) => {
              const s = doneSet.get(p.id) ?? { total: 0, done: 0 }
              const pct = percentDone(s.done, s.total)
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-md">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${PROJECT_COLOR_CLASS[p.color ?? 'violet']}`} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                    <Mark text={p.name} q={query} />
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {s.done}/{s.total} مهام — {pct}%
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {query && (
        <section className="mt-5">
          <h2 className="text-sm font-bold text-slate-500">السجلات ({entryResults.length})</h2>
          <div className="mt-2 space-y-3">
            {entryResults.map((e) => (
              <div key={e.id}>
                <EntryCard
                  entry={e}
                  project={projectMap.get(e.projectId ?? '') ?? null}
                  onOpen={() => setOpenId(e.id)}
                />
                {e.description && e.description.toLowerCase().includes(query.toLowerCase()) && (
                  <p className="mt-1 px-4 text-xs text-slate-400">
                    <span className="font-medium">الوصف: </span>
                    <Mark text={e.description} q={query} />
                  </p>
                )}
              </div>
            ))}
            {entryResults.length === 0 && (
              <EmptyState
                icon={SearchX}
                title={`لا توجد نتائج عن «${query}»`}
                hint="جرِّب كلمة أخرى أو أوسع نطاق البحث"
              />
            )}
          </div>
        </section>
      )}

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}