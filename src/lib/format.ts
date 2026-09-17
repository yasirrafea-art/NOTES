const p2 = (n: number) => String(n).padStart(2, '0')

export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

export function dateToDayKey(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function todayKey(): string {
  return dateToDayKey(new Date())
}

export function parseLocal(s: string): Date {
  if (/(?:z|[+-]\d\d:\d\d)$/i.test(s)) return new Date(s)
  const [datePart, timePart] = s.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (timePart) {
    const [hh, mm, ss] = timePart.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, ss || 0)
  }
  return new Date(y, m - 1, d)
}

export function fmtDate(s: string): string {
  const d = parseLocal(s)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function fmtTime(s: string): string {
  const d = parseLocal(s)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function fmtDateTime(s: string): string {
  return `${fmtDate(s)} ${fmtTime(s)}`
}

export function fmtRelative(s: string): string {
  const key = dateToDayKey(parseLocal(s))
  const today = todayKey()
  if (key === today) return 'اليوم'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (key === dateToDayKey(y)) return 'أمس'
  return fmtDate(s)
}

export function weekdayName(s: string): string {
  const d = parseLocal(s)
  return d.toLocaleDateString('ar-EG', { weekday: 'long' })
}

export function dueLabel(due: string): { label: string; state: 'today' | 'late' | 'upcoming' } {
  const key = dateToDayKey(parseLocal(due))
  const today = todayKey()
  if (key === today) return { label: 'اليوم', state: 'today' }
  if (key < today) return { label: 'متأخرة', state: 'late' }
  return { label: `${fmtDate(due)}`, state: 'upcoming' }
}

export function overdueDays(dueKey: string): number {
  const due = parseLocal(dueKey)
  const now = new Date()
  const diff = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) /
      86400000,
  )
  return Math.max(0, diff)
}

export function overdueText(dueKey: string): string {
  const days = overdueDays(dueKey)
  if (days <= 1) return 'متأخرة يومًا'
  if (days === 2) return 'متأخرة يومين'
  return `متأخرة ${days} أيام`
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ب`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
}

export function percentDone(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0
}