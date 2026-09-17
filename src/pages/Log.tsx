import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { History } from 'lucide-react'
import type { Entry } from '../types'
import { db } from '../db'
import { fmtTime, parseLocal, dateToDayKey, weekdayName } from '../lib/format'
import { KIND_META } from '../lib/constants'
import DetailModal from '../components/DetailModal'
import EmptyState from '../components/EmptyState'

interface DayGroup {
  key: string
  label: string
  items: Entry[]
}

export default function Log() {
  const entries = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []) ?? []
  const [limit, setLimit] = useState(60)
  const [openId, setOpenId] = useState<number | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, DayGroup>()
    for (const e of entries.slice(0, limit)) {
      const key = dateToDayKey(parseLocal(e.createdAt))
      let g = map.get(key)
      if (!g) {
        g = { key, label: weekdayName(e.createdAt), items: [] }
        map.set(key, g)
      }
      g.items.push(e)
    }
    return Array.from(map.values())
  }, [entries, limit])

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
        <History className="h-5 w-5 text-brand-600" />
        السجل الزمني
      </h1>
      <p className="mb-4 text-sm text-slate-400">
        كل ما سجلته بترتيب زمني — اعرف متى كتبت كل شيء ومتى حدث.
      </p>

      {groups.length === 0 && (
        <EmptyState icon={History} title="السجل فارغ" hint="كل ما تضيفه سيظهر هنا تلقائيًا بالتاريخ والوقت" />
      )}

      <div className="space-y-6">
        {groups.map((g) => {
          return (
            <section key={g.key}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">{fmtDay(g.key)}</span>
                <span className="text-sm text-slate-400">{g.label}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="relative mt-3 space-y-3 border-s-2 border-slate-200 ps-5">
                {g.items.map((e) => {
                  const meta = KIND_META[e.kind]
                  const Icon = meta.icon
                  return (
                    <button
                      key={e.id}
                      onClick={() => setOpenId(e.id!)}
                      className="group relative block w-full text-start"
                    >
                      <span
                        className={`absolute -start-[27px] top-1.5 grid h-4 w-4 place-items-center rounded-full ${meta.dot}`}
                      />
                      <div className="card p-3.5 transition group-hover:shadow-md">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className={meta.chip + ' chip'}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                          <span className="font-medium text-slate-400">{fmtTime(e.createdAt)}</span>
                          {e.status === 'done' && (
                            <span className="chip bg-emerald-100 text-emerald-700">تمت</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                          {e.text}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {entries.length > limit && (
        <button onClick={() => setLimit((v) => v + 60)} className="btn-ghost mx-auto mt-6 block">
          عرض المزيد
        </button>
      )}

      {openId != null && <DetailModal entryId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function fmtDay(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}